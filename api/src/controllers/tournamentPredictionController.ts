import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import type { GroupChampionsPicks, GroupStageGroup } from '../db/types';
import {
  findTeamsByIds,
  findUserById,
  getEarliestMatchKickoff,
  listGroupStageGroups,
  upsertTournamentPrediction,
} from '../db/repositories';

function parseDeadline(): Date | null {
  const env = process.env.TOURNAMENT_PREDICTION_DEADLINE?.trim();
  if (env) {
    const parsed = new Date(env);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

async function resolvePredictionDeadline(): Promise<Date | null> {
  return parseDeadline() ?? (await getEarliestMatchKickoff());
}

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

    const deadline = await resolvePredictionDeadline();
    const stored = user.tournamentPrediction;
    const stageGroups = await listGroupStageGroups();
    const groups = await enrichGroupStageForApi(stageGroups);

    if (!stored) {
      return res.json({
        prediction: null,
        groups,
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

    const deadline = await resolvePredictionDeadline();
    if (deadline && new Date() >= deadline) {
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
