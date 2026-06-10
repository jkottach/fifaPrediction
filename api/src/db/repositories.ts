import { ObjectId, Filter } from 'mongodb';
import { getUsersCollection, getTeamsCollection, getMatchesCollection, toObjectId } from '../lib/mongodb';
import type {
  EmbeddedPrediction,
  GroupStageGroup,
  MatchDocument,
  TeamDocument,
  TournamentBracketPrediction,
  UserDocument,
} from './types';
import {
  enrichMatchWithTeams,
  isPickableNationTeamId,
  sumPredictionPoints,
  teamMapFromDocs,
} from './helpers';

// ── Users (`users` collection) ───────────────────────────────────────────────

export async function findUserById(userId: string): Promise<UserDocument | null> {
  const oid = toObjectId(userId);
  if (!oid) return null;
  return getUsersCollection().findOne({ _id: oid });
}

export async function findUserByEmail(email: string): Promise<UserDocument | null> {
  return getUsersCollection().findOne({ email });
}

export async function createUser(
  data: Omit<UserDocument, '_id' | 'predictions' | 'totalPoints' | 'createdAt' | 'updatedAt'> &
    Partial<Pick<UserDocument, 'predictions' | 'totalPoints'>>
): Promise<UserDocument> {
  const now = new Date();
  const doc: UserDocument = {
    ...data,
    _id: new ObjectId(),
    predictions: data.predictions ?? [],
    totalPoints: data.totalPoints ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  await getUsersCollection().insertOne(doc);
  return doc;
}

export async function updateUserById(
  userId: string,
  update: Partial<
    Pick<
      UserDocument,
      | 'firstName'
      | 'lastName'
      | 'phoneNumber'
      | 'city'
      | 'state'
      | 'country'
      | 'googleId'
      | 'profileImage'
      | 'role'
      | 'status'
      | 'isActive'
      | 'totalPoints'
      | 'predictions'
      | 'tournamentPrediction'
    >
  >
): Promise<UserDocument | null> {
  const oid = toObjectId(userId);
  if (!oid) return null;
  await getUsersCollection().updateOne(
    { _id: oid },
    { $set: { ...update, updatedAt: new Date() } }
  );
  return findUserById(userId);
}

export async function recalculateUserTotalPoints(userId: string): Promise<number> {
  const user = await findUserById(userId);
  if (!user) return 0;
  const totalPoints = sumPredictionPoints(user.predictions);
  await updateUserById(userId, { totalPoints });
  return totalPoints;
}

export async function upsertUserPrediction(
  userId: string,
  matchId: string,
  prediction: Omit<EmbeddedPrediction, 'matchId' | 'points'> & { points?: number }
): Promise<EmbeddedPrediction | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  const entry: EmbeddedPrediction = {
    matchId,
    matchTag: prediction.matchTag,
    team1Score: prediction.team1Score,
    team2Score: prediction.team2Score,
    points: prediction.points ?? 0,
    comment: prediction.comment ?? null,
    submittedTime: prediction.submittedTime ?? new Date(),
  };

  const idx = user.predictions.findIndex((p) => p.matchId === matchId);
  const predictions = [...user.predictions];
  if (idx >= 0) {
    predictions[idx] = { ...predictions[idx], ...entry, points: predictions[idx].points ?? entry.points };
  } else {
    predictions.push(entry);
  }

  await updateUserById(userId, {
    predictions,
    totalPoints: sumPredictionPoints(predictions),
  });
  return predictions.find((p) => p.matchId === matchId) ?? null;
}

export async function updatePredictionPointsForMatch(
  userId: string,
  matchId: string,
  points: number
): Promise<void> {
  const user = await findUserById(userId);
  if (!user) return;
  const predictions = user.predictions.map((p) =>
    p.matchId === matchId ? { ...p, points } : p
  );
  await updateUserById(userId, {
    predictions,
    totalPoints: sumPredictionPoints(predictions),
  });
}

export async function findUsersWithPredictionForMatch(matchId: string): Promise<UserDocument[]> {
  return getUsersCollection().find({ 'predictions.matchId': matchId }).toArray();
}

export async function getEarliestMatchKickoff(): Promise<Date | null> {
  const match = await getMatchesCollection()
    .find({ status: { $in: ['scheduled', 'ongoing'] } })
    .sort({ matchTime: 1 })
    .limit(1)
    .next();
  return match?.matchTime ?? null;
}

export async function upsertTournamentPrediction(
  userId: string,
  data: Pick<
    TournamentBracketPrediction,
    'champion' | 'finalists' | 'semifinalists' | 'groupChampions'
  >
): Promise<TournamentBracketPrediction | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  const now = new Date();
  const entry: TournamentBracketPrediction = {
    champion: data.champion,
    finalists: data.finalists,
    semifinalists: data.semifinalists,
    groupChampions: data.groupChampions,
    points: user.tournamentPrediction?.points ?? 0,
    submittedTime: user.tournamentPrediction?.submittedTime ?? now,
    updatedAt: now,
  };

  await updateUserById(userId, { tournamentPrediction: entry });
  return entry;
}

/** Leaderboard-eligible users; legacy docs without `isActive`/`status` are included. */
const activeUserFilter: Filter<UserDocument> = {
  isActive: { $ne: false },
  $nor: [
    { status: { $regex: /^inactive$/i } },
    { status: { $regex: /^suspended$/i } },
  ],
};

export async function listUsersByTotalPoints(limit: number): Promise<UserDocument[]> {
  return getUsersCollection()
    .find(activeUserFilter)
    .sort({ totalPoints: -1, updatedAt: 1 })
    .limit(limit)
    .toArray();
}

export async function countUsersAhead(totalPoints: number): Promise<number> {
  return getUsersCollection().countDocuments({
    ...activeUserFilter,
    totalPoints: { $gt: totalPoints },
  });
}

export async function deleteUserById(userId: string): Promise<boolean> {
  const oid = toObjectId(userId);
  if (!oid) return false;
  const result = await getUsersCollection().deleteOne({ _id: oid });
  return result.deletedCount > 0;
}

// ── Teams (`teams` collection) ────────────────────────────────────────────────

/** Unique teams derived from match fixtures when the `teams` collection is empty. */
export async function listTeamsFromMatches(): Promise<TeamDocument[]> {
  const matches = await getMatchesCollection()
    .find({})
    .project({ team1: 1, team2: 1, team1Info: 1, team2Info: 1 })
    .toArray();

  const byId = new Map<string, TeamDocument>();
  const now = new Date();

  for (const m of matches) {
    const pairs: [string, MatchDocument['team1Info']][] = [
      [m.team1, m.team1Info],
      [m.team2, m.team2Info],
    ];
    for (const [teamId, info] of pairs) {
      if (!teamId || !isPickableNationTeamId(teamId) || byId.has(teamId)) continue;
      byId.set(teamId, {
        _id: new ObjectId(),
        teamId,
        teamName: info?.teamName ?? teamId,
        country: info?.teamName ?? teamId,
        countryLogo: info?.countryLogo ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.teamName.localeCompare(b.teamName));
}

export async function listTeams(): Promise<TeamDocument[]> {
  return getTeamsCollection().find({}).sort({ teamName: 1 }).toArray();
}

/** Teams for pickers: `teams` collection, or match-derived list if collection is empty. */
export async function listTeamsForPicker(): Promise<TeamDocument[]> {
  const fromCollection = await listTeams();
  if (fromCollection.length > 0) return fromCollection;
  return listTeamsFromMatches();
}

export async function findTeamByTeamId(teamId: string): Promise<TeamDocument | null> {
  const fromCollection = await getTeamsCollection().findOne({ teamId });
  if (fromCollection) return fromCollection;
  const fromMatches = await listTeamsFromMatches();
  return fromMatches.find((t) => t.teamId === teamId) ?? null;
}

export async function findTeamsByIds(teamIds: string[]): Promise<TeamDocument[]> {
  if (teamIds.length === 0) return [];
  const fromCollection = await getTeamsCollection().find({ teamId: { $in: teamIds } }).toArray();
  const foundIds = new Set(fromCollection.map((t) => t.teamId));
  const missing = teamIds.filter((id) => !foundIds.has(id));
  if (missing.length === 0) return fromCollection;

  const fromMatches = (await listTeamsFromMatches()).filter((t) => missing.includes(t.teamId));
  return [...fromCollection, ...fromMatches];
}

// ── Matches (`matches` collection) ──────────────────────────────────────────

/** Groups A–L (etc.) with nation `teamId`s derived from group-stage fixtures. */
export async function listGroupStageGroups(): Promise<GroupStageGroup[]> {
  const matches = await getMatchesCollection()
    .find({ group: { $exists: true, $nin: [null, ''] } })
    .project({ group: 1, team1: 1, team2: 1 })
    .toArray();

  const byGroup = new Map<string, Set<string>>();

  for (const m of matches) {
    const group = m.group?.trim().toUpperCase();
    if (!group) continue;
    if (!byGroup.has(group)) byGroup.set(group, new Set());
    const ids = byGroup.get(group)!;
    if (isPickableNationTeamId(m.team1)) ids.add(m.team1);
    if (isPickableNationTeamId(m.team2)) ids.add(m.team2);
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, teamIds]) => ({
      group,
      teamIds: [...teamIds].sort(),
    }));
}

export async function findMatchById(matchId: string): Promise<MatchDocument | null> {
  const oid = toObjectId(matchId);
  if (!oid) return null;
  return getMatchesCollection().findOne({ _id: oid });
}

export async function listMatches(options: {
  status?: string;
  page: number;
  limit: number;
}): Promise<{ matches: MatchDocument[]; total: number }> {
  const filter: Filter<MatchDocument> = {};
  if (options.status) filter.status = options.status;

  const col = getMatchesCollection();
  const [matches, total] = await Promise.all([
    col
      .find(filter)
      .sort({ sequence: 1, matchTime: 1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .toArray(),
    col.countDocuments(filter),
  ]);
  return { matches, total };
}

export async function createMatch(
  data: Omit<MatchDocument, '_id' | 'createdAt' | 'updatedAt'>
): Promise<MatchDocument> {
  const now = new Date();
  const doc: MatchDocument = {
    _id: new ObjectId(),
    createdAt: now,
    updatedAt: now,
    ...data,
  };
  await getMatchesCollection().insertOne(doc);
  return doc;
}

export async function updateMatchById(
  matchId: string,
  update: Partial<Omit<MatchDocument, '_id' | 'createdAt'>>
): Promise<MatchDocument | null> {
  const oid = toObjectId(matchId);
  if (!oid) return null;
  await getMatchesCollection().updateOne(
    { _id: oid },
    { $set: { ...update, updatedAt: new Date() } }
  );
  return findMatchById(matchId);
}

export async function deleteMatchById(matchId: string): Promise<boolean> {
  const oid = toObjectId(matchId);
  if (!oid) return false;
  const result = await getMatchesCollection().deleteOne({ _id: oid });
  if (result.deletedCount > 0) {
    await getUsersCollection().updateMany(
      {},
      { $pull: { predictions: { matchId } } }
    );
    const users = await getUsersCollection().find({}).toArray();
    for (const u of users) {
      await recalculateUserTotalPoints(u._id.toString());
    }
  }
  return result.deletedCount > 0;
}

export async function resolveTeamInfoForMatch(team1: string, team2: string) {
  const teams = await findTeamsByIds([team1, team2]);
  const map = teamMapFromDocs(teams);
  return {
    team1Info: map.get(team1) ?? { teamName: team1, countryLogo: null },
    team2Info: map.get(team2) ?? { teamName: team2, countryLogo: null },
  };
}

export async function getEnrichedMatches(matches: MatchDocument[]) {
  const teamIds = [
    ...new Set(
      matches.flatMap((m) =>
        [m.team1, m.team2].filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    ),
  ];
  const teams = teamIds.length > 0 ? await findTeamsByIds(teamIds) : [];
  const teamById = teamMapFromDocs(teams);
  return matches.map((m) => enrichMatchWithTeams(m, teamById));
}

export async function getEnrichedMatch(match: MatchDocument) {
  const teams = await findTeamsByIds([match.team1, match.team2]);
  return enrichMatchWithTeams(match, teamMapFromDocs(teams));
}

export async function attachMatchToPredictions(
  user: UserDocument,
  predictionsPage: EmbeddedPrediction[]
) {
  const matchIds = [...new Set(predictionsPage.map((p) => p.matchId))];
  const matches = await Promise.all(matchIds.map((id) => findMatchById(id)));
  const matchById = new Map(
    matches.filter(Boolean).map((m) => [m!._id.toString(), m!])
  );
  const teamIds = [...new Set(matches.flatMap((m) => (m ? [m.team1, m.team2] : [])))];
  const teamById = teamMapFromDocs(await findTeamsByIds(teamIds));

  return predictionsPage.map((p) => {
    const match = matchById.get(p.matchId);
    const apiMatch = match ? enrichMatchWithTeams(match, teamById) : null;
    return {
      id: `${user._id.toString()}_${p.matchId}`,
      userId: user._id.toString(),
      matchId: apiMatch,
      matchTag: p.matchTag,
      team1Score: p.team1Score,
      team2Score: p.team2Score,
      team1PredictedScore: p.team1Score,
      team2PredictedScore: p.team2Score,
      points: p.points,
      comment: p.comment,
      submittedTime: p.submittedTime,
    };
  });
}
