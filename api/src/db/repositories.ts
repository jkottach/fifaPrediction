import { ObjectId, Filter } from 'mongodb';
import { getDb, getUsersCollection, getTeamsCollection, getMatchesCollection, toObjectId } from '../lib/mongodb';
import type {
  EmbeddedPrediction,
  GroupChampionsPicks,
  GroupStageGroup,
  MatchDocument,
  TeamDocument,
  TournamentBracketPrediction,
  TournamentOfficialResults,
  TournamentResultsSettingsDocument,
  UserDocument,
} from './types';
import { HARDCODED_GROUP_STAGE } from '../constants/tournamentTeams';
import { canRevealLivePredictions } from '../utils/matchStatus';
import {
  enrichMatchWithTeams,
  isPickableNationTeamId,
  sumPredictionPoints,
  teamMapFromDocs,
  computeUserTotalPoints,
} from './helpers';
import { normalizeGoalScore } from '../utils/goalScore';

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
  const totalPoints = computeUserTotalPoints(user);
  await updateUserById(userId, { totalPoints });
  return totalPoints;
}

export async function recalculateAllUserTotalPoints(): Promise<number> {
  const users = await getUsersCollection().find({}).toArray();
  let updated = 0;
  for (const user of users) {
    const totalPoints = computeUserTotalPoints(user);
    if (totalPoints !== (user.totalPoints ?? 0)) {
      await updateUserById(user._id.toString(), { totalPoints });
      updated += 1;
    }
  }
  return updated;
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
    team1Score: normalizeGoalScore(prediction.team1Score),
    team2Score: normalizeGoalScore(prediction.team2Score),
    points: prediction.points ?? 0,
    comment: prediction.comment ?? null,
    submittedTime: prediction.submittedTime ?? new Date(),
    penaltyWinner: prediction.penaltyWinner ?? null,
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
    totalPoints: computeUserTotalPoints({
      predictions,
      tournamentPrediction: user.tournamentPrediction,
    }),
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
    totalPoints: computeUserTotalPoints({
      predictions,
      tournamentPrediction: user.tournamentPrediction,
    }),
  });
}

export async function findUsersWithPredictionForMatch(matchId: string): Promise<UserDocument[]> {
  return getUsersCollection().find({ 'predictions.matchId': matchId }).toArray();
}

export async function findLatestCompletedMatch(): Promise<MatchDocument | null> {
  return getMatchesCollection()
    .find({ status: 'completed' })
    .sort({ updatedAt: -1, matchTime: -1 })
    .limit(1)
    .next();
}

export async function getEarliestMatchKickoff(): Promise<Date | null> {
  const match = await getMatchesCollection()
    .find({ status: { $in: ['scheduled', 'ongoing'] } })
    .sort({ matchTime: 1 })
    .limit(1)
    .next();
  return match?.matchTime ?? null;
}

const TOURNAMENT_RESULTS_DOC_ID = 'tournamentResults';

export async function loadTournamentOfficialResults(): Promise<TournamentOfficialResults | null> {
  const doc = await getDb()
    .collection<TournamentResultsSettingsDocument>('settings')
    .findOne({ _id: TOURNAMENT_RESULTS_DOC_ID });
  if (!doc) return null;

  const groupChampions: GroupChampionsPicks = {};
  const raw = doc.groupChampions as GroupChampionsPicks | undefined;
  if (raw && typeof raw === 'object') {
    for (const [group, teamId] of Object.entries(raw)) {
      const g = group.trim().toUpperCase();
      const id = String(teamId).trim().toUpperCase();
      if (g && id) groupChampions[g] = id;
    }
  }

  return {
    champion: String(doc.champion ?? '').trim().toUpperCase(),
    finalists: [
      String(doc.finalists?.[0] ?? '').trim().toUpperCase(),
      String(doc.finalists?.[1] ?? '').trim().toUpperCase(),
    ],
    semifinalists: [
      String(doc.semifinalists?.[0] ?? '').trim().toUpperCase(),
      String(doc.semifinalists?.[1] ?? '').trim().toUpperCase(),
      String(doc.semifinalists?.[2] ?? '').trim().toUpperCase(),
      String(doc.semifinalists?.[3] ?? '').trim().toUpperCase(),
    ],
    groupChampions,
  };
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

  if (byGroup.size === 0) {
    return HARDCODED_GROUP_STAGE.map(({ group, teamIds }) => ({ group, teamIds: [...teamIds] }));
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, teamIds]) => ({
      group,
      teamIds: [...teamIds].sort(),
    }));
}

export interface CommunityTournamentPickRow {
  userId: string;
  name: string;
  champion: string;
  finalists: [string, string];
  semifinalists: [string, string, string, string];
  groupChampions?: GroupChampionsPicks;
  points: number;
  submittedTime: Date;
}

export interface CommunityTeamCount {
  teamId: string;
  count: number;
  pct?: number;
}

export interface CommunityTournamentConsensus {
  champion: CommunityTeamCount[];
  groupChampions: Record<string, CommunityTeamCount[]>;
  semifinalists: CommunityTeamCount[];
  finalists: CommunityTeamCount[];
}

function incrementCount(map: Map<string, number>, teamId: string): void {
  const id = teamId.trim().toUpperCase();
  if (!id) return;
  map.set(id, (map.get(id) ?? 0) + 1);
}

function sortedCounts(map: Map<string, number>, total: number): CommunityTeamCount[] {
  return [...map.entries()]
    .map(([teamId, count]) => ({ teamId, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.teamId.localeCompare(b.teamId));
}

export async function listCommunityTournamentPredictions(): Promise<{
  picks: CommunityTournamentPickRow[];
  consensus: CommunityTournamentConsensus;
  submittedCount: number;
}> {
  const users = await getUsersCollection()
    .find({
      ...activeUserFilter,
      tournamentPrediction: { $exists: true, $ne: null },
    })
    .toArray();

  const picks: CommunityTournamentPickRow[] = [];
  const championCounts = new Map<string, number>();
  const semifinalistCounts = new Map<string, number>();
  const finalistCounts = new Map<string, number>();
  const groupCounts = new Map<string, Map<string, number>>();

  for (const user of users) {
    const stored = user.tournamentPrediction;
    if (!stored?.champion) continue;

    picks.push({
      userId: user._id.toString(),
      name: leaderboardDisplayName(user),
      champion: stored.champion,
      finalists: stored.finalists,
      semifinalists: stored.semifinalists,
      groupChampions: stored.groupChampions,
      points: stored.points ?? 0,
      submittedTime: stored.submittedTime,
    });

    incrementCount(championCounts, stored.champion);
    for (const semi of stored.semifinalists) incrementCount(semifinalistCounts, semi);
    for (const fin of stored.finalists) incrementCount(finalistCounts, fin);
    if (stored.groupChampions) {
      for (const [group, teamId] of Object.entries(stored.groupChampions)) {
        const g = group.trim().toUpperCase();
        if (!g) continue;
        if (!groupCounts.has(g)) groupCounts.set(g, new Map());
        incrementCount(groupCounts.get(g)!, teamId);
      }
    }
  }

  const submittedCount = picks.length;

  picks.sort((a, b) => {
    const pointsDiff = b.points - a.points;
    if (pointsDiff !== 0) return pointsDiff;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const groupChampionsConsensus: Record<string, CommunityTeamCount[]> = {};
  for (const [group, counts] of groupCounts.entries()) {
    groupChampionsConsensus[group] = sortedCounts(counts, submittedCount).map(
      ({ teamId, count }) => ({ teamId, count })
    );
  }

  return {
    picks,
    submittedCount,
    consensus: {
      champion: sortedCounts(championCounts, submittedCount),
      groupChampions: groupChampionsConsensus,
      semifinalists: sortedCounts(semifinalistCounts, submittedCount).map(({ teamId, count }) => ({
        teamId,
        count,
      })),
      finalists: sortedCounts(finalistCounts, submittedCount).map(({ teamId, count }) => ({
        teamId,
        count,
      })),
    },
  };
}

/** Active users; legacy docs without `isActive` are included. */
const activeUserFilter: Filter<UserDocument> = {
  $or: [{ isActive: true }, { isActive: { $exists: false } }],
};

function leaderboardDisplayName(user: UserDocument): string {
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'User';
}

export interface MatchEarnerRow {
  rank: number;
  userId: string;
  name: string;
  points: number;
  team1Score: number;
  team2Score: number;
}

export async function listTopEarnersForMatch(
  matchId: string,
  limit: number
): Promise<MatchEarnerRow[]> {
  const users = await getUsersCollection()
    .find({
      ...activeUserFilter,
      'predictions.matchId': matchId,
    })
    .toArray();

  const rows = users
    .map((user) => {
      const pred = user.predictions.find((p) => p.matchId === matchId);
      if (!pred) return null;
      return {
        userId: user._id.toString(),
        name: leaderboardDisplayName(user),
        points: pred.points ?? 0,
        team1Score: pred.team1Score,
        team2Score: pred.team2Score,
      };
    })
    .filter((row): row is Omit<MatchEarnerRow, 'rank'> => row !== null)
    .sort((a, b) => {
      const diff = b.points - a.points;
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

  let denseRank = 0;
  let previousPoints: number | null = null;

  const ranked: MatchEarnerRow[] = rows.map((row) => {
    if (previousPoints === null || row.points !== previousPoints) {
      denseRank += 1;
      previousPoints = row.points;
    }
    return { ...row, rank: denseRank };
  });

  return ranked.slice(0, limit);
}

export interface LiveMatchPredictionRow {
  userId: string;
  name: string;
  team1Score: number;
  team2Score: number;
  submittedTime: Date;
  comment?: string | null;
}

export async function listLiveMatchesWithPredictions(): Promise<
  Array<{ match: MatchDocument; predictions: LiveMatchPredictionRow[] }>
> {
  const now = new Date();
  const nowMs = now.getTime();

  const candidates = await getMatchesCollection()
    .find({
      status: { $ne: 'completed' },
      $or: [{ status: 'ongoing' }, { matchTime: { $lte: now } }],
    })
    .sort({ matchTime: 1 })
    .toArray();

  const results: Array<{ match: MatchDocument; predictions: LiveMatchPredictionRow[] }> = [];

  for (const match of candidates) {
    if (!canRevealLivePredictions(match, nowMs)) continue;

    const matchId = match._id.toString();
    const users = await getUsersCollection()
      .find({
        ...activeUserFilter,
        'predictions.matchId': matchId,
      })
      .toArray();

    const predictions: LiveMatchPredictionRow[] = [];

    for (const user of users) {
      const pred = user.predictions.find((p) => p.matchId === matchId);
      if (!pred) continue;

      predictions.push({
        userId: user._id.toString(),
        name: leaderboardDisplayName(user),
        team1Score: pred.team1Score,
        team2Score: pred.team2Score,
        submittedTime: pred.submittedTime,
        ...(pred.comment ? { comment: pred.comment } : {}),
      });
    }

    predictions.sort((a, b) => {
      const scoreDiff = b.team1Score - a.team1Score;
      if (scoreDiff !== 0) return scoreDiff;
      const team2Diff = b.team2Score - a.team2Score;
      if (team2Diff !== 0) return team2Diff;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    results.push({ match, predictions });
  }

  return results;
}

function denseOverallRankFromTotals(
  totals: Array<{ userId: string; total: number }>
): Map<string, number | null> {
  const sorted = [...totals].sort((a, b) => b.total - a.total);
  const rankByUserId = new Map<string, number | null>();
  let denseRank = 0;
  let previousPoints: number | null = null;

  for (const row of sorted) {
    if (row.total <= 0) {
      rankByUserId.set(row.userId, null);
      continue;
    }
    if (previousPoints === null || row.total !== previousPoints) {
      denseRank += 1;
      previousPoints = row.total;
    }
    rankByUserId.set(row.userId, denseRank);
  }

  return rankByUserId;
}

/** Write cumulative total + overall rank on each user's prediction for a completed match milestone. */
export async function applyPredictionSnapshotsAtMilestone(
  matchId: string,
  completedMatchIds: Set<string>
): Promise<number> {
  const allUsers = await getUsersCollection().find(activeUserFilter).toArray();

  const totals = allUsers.map((user) => ({
    userId: user._id.toString(),
    total: user.predictions
      .filter((p) => completedMatchIds.has(p.matchId))
      .reduce((sum, p) => sum + (p.points ?? 0), 0),
  }));

  const rankByUserId = denseOverallRankFromTotals(totals);
  const totalByUserId = new Map(totals.map((t) => [t.userId, t.total]));

  let updated = 0;

  for (const user of allUsers) {
    const idx = user.predictions.findIndex((p) => p.matchId === matchId);
    if (idx < 0) continue;

    const userId = user._id.toString();
    const predictions = [...user.predictions];
    const cumulativeTotalPoints = totalByUserId.get(userId) ?? 0;
    const overallRank = rankByUserId.get(userId) ?? null;

    predictions[idx] = {
      ...predictions[idx],
      cumulativeTotalPoints,
      overallRank,
    };

    await updateUserById(userId, {
      predictions,
      totalPoints: computeUserTotalPoints({
        predictions,
        tournamentPrediction: user.tournamentPrediction,
      }),
    });
    updated += 1;
  }

  return updated;
}

/** Replay completed matches in order and persist snapshot fields on embedded predictions. */
export async function backfillAllPredictionSnapshots(): Promise<{
  matchesProcessed: number;
  predictionsUpdated: number;
}> {
  const completedMatches = await getMatchesCollection()
    .find({ status: 'completed' })
    .sort({ matchTime: 1, sequence: 1 })
    .toArray();

  const completedMatchIds = new Set<string>();
  let predictionsUpdated = 0;

  for (const match of completedMatches) {
    const matchId = match._id.toString();
    completedMatchIds.add(matchId);
    predictionsUpdated += await applyPredictionSnapshotsAtMilestone(matchId, completedMatchIds);
  }

  return { matchesProcessed: completedMatches.length, predictionsUpdated };
}

export async function applySnapshotsAfterMatchFinalized(matchId: string): Promise<void> {
  const completedMatches = await getMatchesCollection()
    .find({ status: 'completed' })
    .sort({ matchTime: 1, sequence: 1 })
    .toArray();
  const completedMatchIds = new Set(completedMatches.map((m) => m._id.toString()));
  await applyPredictionSnapshotsAtMilestone(matchId, completedMatchIds);
}

/** Compute overall rank after each completed match (read-time fallback when snapshots are missing). */
export async function computeOverallRankByPredictionId(
  userId: string
): Promise<Map<string, number | null>> {
  const completedMatches = await getMatchesCollection()
    .find({ status: 'completed' })
    .sort({ matchTime: 1, sequence: 1 })
    .toArray();

  const allUsers = await getUsersCollection().find(activeUserFilter).toArray();
  const completedMatchIds = new Set<string>();
  const rankByPredictionId = new Map<string, number | null>();

  for (const match of completedMatches) {
    const matchId = match._id.toString();
    completedMatchIds.add(matchId);

    const totals = allUsers.map((user) => ({
      userId: user._id.toString(),
      total: user.predictions
        .filter((p) => completedMatchIds.has(p.matchId))
        .reduce((sum, p) => sum + (p.points ?? 0), 0),
    }));

    const rankByUserId = denseOverallRankFromTotals(totals);
    const user = allUsers.find((u) => u._id.toString() === userId);
    if (user?.predictions.some((p) => p.matchId === matchId)) {
      rankByPredictionId.set(`${userId}_${matchId}`, rankByUserId.get(userId) ?? null);
    }
  }

  return rankByPredictionId;
}

export async function listUsersByTotalPoints(limit: number): Promise<UserDocument[]> {
  return getUsersCollection()
    .find(activeUserFilter)
    .sort({ totalPoints: -1, firstName: 1, lastName: 1, email: 1 })
    .limit(limit)
    .toArray();
}

export async function listCompletedMatchIdsInOrder(): Promise<string[]> {
  const completedMatches = await getMatchesCollection()
    .find({ status: 'completed' })
    .sort({ matchTime: 1, sequence: 1 })
    .project({ _id: 1 })
    .toArray();
  return completedMatches.map((match) => match._id.toString());
}

export async function computeMatchOnlyRanksAtMilestone(
  completedMatchIds: string[]
): Promise<Map<string, number | null>> {
  const allUsers = await getUsersCollection().find(activeUserFilter).toArray();
  const completedSet = new Set(completedMatchIds);
  const totals = allUsers.map((user) => ({
    userId: user._id.toString(),
    total: user.predictions
      .filter((p) => completedSet.has(p.matchId))
      .reduce((sum, p) => sum + (p.points ?? 0), 0),
  }));
  return denseOverallRankFromTotals(totals);
}

export type RankTrend = 'up' | 'down' | 'unchanged';

export function rankTrendFromRanks(
  rankAfter: number | null | undefined,
  rankBefore: number | null | undefined
): RankTrend | null {
  if (rankAfter == null || rankBefore == null) return null;
  if (rankAfter < rankBefore) return 'up';
  if (rankAfter > rankBefore) return 'down';
  return 'unchanged';
}

export async function computeRankTrendAfterLastGame(): Promise<Map<string, RankTrend | null>> {
  const completedMatchIds = await listCompletedMatchIdsInOrder();
  const trends = new Map<string, RankTrend | null>();
  if (completedMatchIds.length < 2) return trends;

  const [ranksBeforeLastGame, ranksAfterLastGame] = await Promise.all([
    computeMatchOnlyRanksAtMilestone(completedMatchIds.slice(0, -1)),
    computeMatchOnlyRanksAtMilestone(completedMatchIds),
  ]);

  const userIds = new Set([...ranksBeforeLastGame.keys(), ...ranksAfterLastGame.keys()]);
  for (const userId of userIds) {
    trends.set(
      userId,
      rankTrendFromRanks(ranksAfterLastGame.get(userId), ranksBeforeLastGame.get(userId))
    );
  }

  return trends;
}

export async function countUsersAhead(totalPoints: number): Promise<number> {
  return getUsersCollection().countDocuments({
    ...activeUserFilter,
    totalPoints: { $gt: totalPoints },
  });
}

/** Distinct point totals strictly above the given score (for dense rank). */
export async function countDistinctPointTiersAhead(totalPoints: number): Promise<number> {
  const tiers = await getUsersCollection().distinct('totalPoints', {
    ...activeUserFilter,
    totalPoints: { $gt: totalPoints },
  });
  return tiers.length;
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

export async function findMatchById(matchId: string): Promise<MatchDocument | null> {
  const oid = toObjectId(matchId);
  if (!oid) return null;
  return getMatchesCollection().findOne({ _id: oid });
}

export async function listMatches(options: {
  status?: string;
  openForPredictions?: boolean;
  page: number;
  limit: number;
}): Promise<{ matches: MatchDocument[]; total: number }> {
  const filter: Filter<MatchDocument> = {};
  if (options.openForPredictions) {
    const now = new Date();
    const recentKickoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    filter.$or = [
      { status: 'ongoing' },
      { status: 'scheduled', predictionsEndingTime: { $gt: now } },
      // Predictions closed but kickoff was recent — still show locked pick until finalized.
      { status: 'scheduled', matchTime: { $gte: recentKickoff } },
    ];
  } else if (options.status) {
    filter.status = options.status;
  }

  const col = getMatchesCollection();
  const [matches, total] = await Promise.all([
    col
      .find(filter)
      .sort({ matchTime: 1 })
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
      penaltyWinner: p.penaltyWinner ?? null,
      cumulativeTotalPoints: p.cumulativeTotalPoints,
      overallRank: p.overallRank,
    };
  });
}
