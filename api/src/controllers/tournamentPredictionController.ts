import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import type { GroupChampionsPicks, GroupStageGroup } from '../db/types';
import {
  isTournamentPredictionDeadlinePassed,
  resolvePredictionDeadline,
} from '../utils/tournamentDeadline';
import {
  findTeamsByIds,
  findUserById,
  listCommunityTournamentPredictions,
  listGroupStageGroups,
  loadTournamentOfficialResults,
  upsertTournamentPrediction,
} from '../db/repositories';

function uniqueTeamIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

function validateBracketLogic(
  champion: string,
  finalists: [string, string],
  semifinalists: [string, string, string, string]
): string | null {
  if (!uniqueTeamIds(semifinalists)) {
    return 'Each semifinalist must be a different team';
  }
  if (!uniqueTeamIds(finalists)) {
    return 'Your two finalists must be different teams';
  }
  if (!finalists.includes(champion)) {
    return 'Champion must be one of your two finalist picks';
  }
  for (const f of finalists) {
    if (!semifinalists.includes(f)) {
      return 'Both finalists must be chosen from your four semifinalist picks';
    }
  }
  return null;
}

function normalizeGroupChampions(raw: GroupChampionsPicks): GroupChampionsPicks {
  const normalized: GroupChampionsPicks = {};
  for (const [group, teamId] of Object.entries(raw)) {
    const g = group.trim().toUpperCase();
    const id = teamId.trim().toUpperCase();
    if (g && id) normalized[g] = id;
  }
  return normalized;
}

function validateGroupChampions(
  groupChampions: GroupChampionsPicks,
  stageGroups: GroupStageGroup[]
): string | null {
  if (stageGroups.length === 0) return null;

  for (const { group, teamIds } of stageGroups) {
    const pick = groupChampions[group];
    if (!pick) {
      return `Pick a winner for Group ${group}`;
    }
    if (!teamIds.includes(pick)) {
      return `${pick} is not a valid team in Group ${group}`;
    }
  }

  return null;
}

async function enrichGroupStageForApi(stageGroups: GroupStageGroup[]) {
  const allTeamIds = [...new Set(stageGroups.flatMap((g) => g.teamIds))];
  const teams = await findTeamsByIds(allTeamIds);
  const teamById = new Map(teams.map((t) => [t.teamId, t]));

  return stageGroups.map(({ group, teamIds }) => ({
    group,
    teams: teamIds.map((teamId) => {
      const t = teamById.get(teamId);
      return {
        teamId,
        teamName: t?.teamName ?? teamId,
        countryLogo: t?.countryLogo ?? null,
      };
    }),
  }));
}

function enrichGroupChampionPicks(
  groupChampions: GroupChampionsPicks | undefined,
  teamById: Map<string, { teamName: string; countryLogo?: string | null }>
) {
  if (!groupChampions) return undefined;
  const entries = Object.entries(groupChampions).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([group, teamId]) => {
    const t = teamById.get(teamId);
    return {
      group,
      teamId,
      teamName: t?.teamName ?? teamId,
      countryLogo: t?.countryLogo ?? null,
    };
  });
}

export const getTournamentPrediction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const deadline = resolvePredictionDeadline();
    const stored = user.tournamentPrediction;
    const [stageGroups, officialResults] = await Promise.all([
      listGroupStageGroups(),
      loadTournamentOfficialResults(),
    ]);
    const groups = await enrichGroupStageForApi(stageGroups);
    const officialGroupChampions = officialResults?.groupChampions ?? {};

    if (!stored) {
      return res.json({
        prediction: null,
        groups,
        officialGroupChampions,
        deadline: deadline?.toISOString() ?? null,
        isOpen: deadline ? new Date() < deadline : true,
      });
    }

    const groupPickIds = stored.groupChampions ? Object.values(stored.groupChampions) : [];
    const teamIds = [
      stored.champion,
      ...stored.finalists,
      ...stored.semifinalists,
      ...groupPickIds,
    ];
    const teams = await findTeamsByIds(teamIds);
    const teamById = new Map(teams.map((t) => [t.teamId, t]));

    const enrich = (teamId: string) => {
      const t = teamById.get(teamId);
      return {
        teamId,
        teamName: t?.teamName ?? teamId,
        countryLogo: t?.countryLogo ?? null,
      };
    };

    res.json({
      prediction: {
        champion: enrich(stored.champion),
        finalists: stored.finalists.map(enrich),
        semifinalists: stored.semifinalists.map(enrich),
        groupChampions: enrichGroupChampionPicks(stored.groupChampions, teamById),
        points: stored.points ?? 0,
        submittedTime: stored.submittedTime,
        updatedAt: stored.updatedAt,
      },
      groups,
      officialGroupChampions,
      deadline: deadline?.toISOString() ?? null,
      isOpen: deadline ? new Date() < deadline : true,
    });
  } catch (error) {
    const errorDetails = logger.error('getTournamentPrediction', error, {
      userId: req.user?.userId,
    });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to fetch tournament prediction' });
  }
};

export const submitTournamentPrediction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const { champion, finalists, semifinalists, groupChampions: rawGroupChampions } = req.body as {
      champion: string;
      finalists: [string, string];
      semifinalists: [string, string, string, string];
      groupChampions?: GroupChampionsPicks;
    };

    const deadline = resolvePredictionDeadline();
    if (new Date() >= deadline) {
      return res.status(400).json({ error: 'Tournament prediction deadline has passed' });
    }

    const logicError = validateBracketLogic(champion, finalists, semifinalists);
    if (logicError) return res.status(400).json({ error: logicError });

    const stageGroups = await listGroupStageGroups();
    const groupChampions = normalizeGroupChampions(rawGroupChampions ?? {});
    const groupError = validateGroupChampions(groupChampions, stageGroups);
    if (groupError) return res.status(400).json({ error: groupError });

    const uniqueIds = [
      ...new Set([champion, ...finalists, ...semifinalists, ...Object.values(groupChampions)]),
    ];
    const knownTeams = await findTeamsByIds(uniqueIds);
    if (knownTeams.length !== uniqueIds.length) {
      return res.status(400).json({ error: 'One or more selected teams are invalid' });
    }

    const userBefore = await findUserById(userId);
    const isUpdate = Boolean(userBefore?.tournamentPrediction);

    const saved = await upsertTournamentPrediction(userId, {
      champion,
      finalists,
      semifinalists,
      groupChampions: stageGroups.length > 0 ? groupChampions : undefined,
    });

    res.status(isUpdate ? 200 : 201).json({
      message: isUpdate
        ? 'Tournament prediction updated successfully'
        : 'Tournament prediction submitted successfully',
      prediction: saved,
    });
  } catch (error) {
    const errorDetails = logger.error('submitTournamentPrediction', error, {
      userId: req.user?.userId,
    });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to submit tournament prediction' });
  }
};

function enrichTeam(
  teamId: string,
  teamById: Map<string, { teamName: string; countryLogo?: string | null }>
) {
  const t = teamById.get(teamId);
  return {
    teamId,
    teamName: t?.teamName ?? teamId,
    countryLogo: t?.countryLogo ?? null,
  };
}

function enrichConsensusTeam(
  entry: { teamId: string; count: number; pct?: number },
  teamById: Map<string, { teamName: string; countryLogo?: string | null }>
) {
  const t = teamById.get(entry.teamId);
  return {
    teamId: entry.teamId,
    teamName: t?.teamName ?? entry.teamId,
    countryLogo: t?.countryLogo ?? null,
    count: entry.count,
    ...(entry.pct != null ? { pct: entry.pct } : {}),
  };
}

async function enrichCommunityPayload(
  raw: Awaited<ReturnType<typeof listCommunityTournamentPredictions>>
) {
  const allTeamIds = new Set<string>();
  for (const pick of raw.picks) {
    allTeamIds.add(pick.champion);
    pick.finalists.forEach((id) => allTeamIds.add(id));
    pick.semifinalists.forEach((id) => allTeamIds.add(id));
    if (pick.groupChampions) {
      Object.values(pick.groupChampions).forEach((id) => allTeamIds.add(id));
    }
  }
  for (const row of raw.consensus.champion) allTeamIds.add(row.teamId);
  for (const rows of Object.values(raw.consensus.groupChampions)) {
    rows.forEach((row) => allTeamIds.add(row.teamId));
  }
  raw.consensus.semifinalists.forEach((row) => allTeamIds.add(row.teamId));
  raw.consensus.finalists.forEach((row) => allTeamIds.add(row.teamId));

  const teams = await findTeamsByIds([...allTeamIds]);
  const teamById = new Map(teams.map((t) => [t.teamId, t]));

  return {
    submittedCount: raw.submittedCount,
    picks: raw.picks.map((pick) => ({
      userId: pick.userId,
      name: pick.name,
      champion: enrichTeam(pick.champion, teamById),
      finalists: pick.finalists.map((id) => enrichTeam(id, teamById)),
      semifinalists: pick.semifinalists.map((id) => enrichTeam(id, teamById)),
      groupChampions: enrichGroupChampionPicks(pick.groupChampions, teamById),
      points: pick.points,
      submittedTime: pick.submittedTime,
    })),
    consensus: {
      champion: raw.consensus.champion.map((row) => enrichConsensusTeam(row, teamById)),
      groupChampions: Object.fromEntries(
        Object.entries(raw.consensus.groupChampions).map(([group, rows]) => [
          group,
          rows.map((row) => enrichConsensusTeam(row, teamById)),
        ])
      ),
      semifinalists: raw.consensus.semifinalists.map((row) =>
        enrichConsensusTeam(row, teamById)
      ),
      finalists: raw.consensus.finalists.map((row) => enrichConsensusTeam(row, teamById)),
    },
  };
}

export const getCommunityTournamentPredictions = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated' });

    const deadline = resolvePredictionDeadline();
    const officialResults = await loadTournamentOfficialResults();
    const officialGroupChampions = officialResults?.groupChampions ?? {};

    if (!isTournamentPredictionDeadlinePassed()) {
      const { submittedCount } = await listCommunityTournamentPredictions();
      return res.status(403).json({
        error: 'Community tournament picks are hidden until the deadline',
        unlocksAt: deadline.toISOString(),
        submittedCount,
        officialGroupChampions,
      });
    }

    const raw = await listCommunityTournamentPredictions();
    const enriched = await enrichCommunityPayload(raw);

    res.json({
      unlocksAt: deadline.toISOString(),
      officialGroupChampions,
      ...enriched,
    });
  } catch (error) {
    const errorDetails = logger.error('getCommunityTournamentPredictions', error, {
      userId: req.user?.userId,
    });
    res.status(errorDetails.statusCode || 500).json({
      error: 'Failed to fetch community tournament predictions',
    });
  }
};

export const getUserTournamentPrediction = async (req: AuthRequest, res: Response) => {
  try {
    const requesterId = req.user?.userId;
    if (!requesterId) return res.status(401).json({ error: 'User not authenticated' });

    const targetUserId = String(req.params.userId ?? '').trim();
    if (!targetUserId) return res.status(400).json({ error: 'User id is required' });

    const deadline = resolvePredictionDeadline();
    const officialResults = await loadTournamentOfficialResults();
    const officialGroupChampions = officialResults?.groupChampions ?? {};

    if (!isTournamentPredictionDeadlinePassed() && targetUserId !== requesterId) {
      return res.status(403).json({
        error: 'Community tournament picks are hidden until the deadline',
        unlocksAt: deadline.toISOString(),
      });
    }

    const user = await findUserById(targetUserId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const stored = user.tournamentPrediction;
    if (!stored?.champion) {
      return res.json({ prediction: null, officialGroupChampions });
    }

    const groupPickIds = stored.groupChampions ? Object.values(stored.groupChampions) : [];
    const teamIds = [
      stored.champion,
      ...stored.finalists,
      ...stored.semifinalists,
      ...groupPickIds,
    ];
    const teams = await findTeamsByIds(teamIds);
    const teamById = new Map(teams.map((t) => [t.teamId, t]));

    res.json({
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'User',
      officialGroupChampions,
      prediction: {
        champion: enrichTeam(stored.champion, teamById),
        finalists: stored.finalists.map((id) => enrichTeam(id, teamById)),
        semifinalists: stored.semifinalists.map((id) => enrichTeam(id, teamById)),
        groupChampions: enrichGroupChampionPicks(stored.groupChampions, teamById),
        points: stored.points ?? 0,
        submittedTime: stored.submittedTime,
        updatedAt: stored.updatedAt,
      },
    });
  } catch (error) {
    const errorDetails = logger.error('getUserTournamentPrediction', error, {
      userId: req.user?.userId,
      targetUserId: req.params.userId,
    });
    res.status(errorDetails.statusCode || 500).json({
      error: 'Failed to fetch user tournament prediction',
    });
  }
};
