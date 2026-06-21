import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import { buildMatchTag, formatMatchForApi } from '../db/helpers';
import {
  createMatch as insertMatch,
  deleteMatchById,
  findLatestCompletedMatch,
  findMatchById,
  getEnrichedMatch,
  getEnrichedMatches,
  listMatches,
  listLiveMatchesWithPredictions,
  listTeamsForPicker,
  listTopEarnersForMatch,
  resolveTeamInfoForMatch,
  updateMatchById,
} from '../db/repositories';

export const getAllTeams = async (_req: AuthRequest, res: Response) => {
  try {
    const teams = await listTeamsForPicker();
    res.json({
      teams: teams.map((t) => ({
        teamId: t.teamId,
        teamName: t.teamName,
        countryLogo: t.countryLogo,
      })),
    });
  } catch (error) {
    const errorDetails = logger.error('getAllTeams', error, { method: 'GET', path: '/teams' });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to fetch teams' });
  }
};

function parseListQuery(query: AuthRequest['query']) {
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const rawLimit = Array.isArray(query.limit) ? query.limit[0] : query.limit;
  const rawStatus = Array.isArray(query.status) ? query.status[0] : query.status;
  const rawOpen = Array.isArray(query.openForPredictions)
    ? query.openForPredictions[0]
    : query.openForPredictions;

  const pageNum = Math.max(1, parseInt(String(rawPage ?? '1'), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(rawLimit ?? '10'), 10) || 10));
  const status =
    typeof rawStatus === 'string' && rawStatus.trim() ? rawStatus.trim() : undefined;
  const openForPredictions = rawOpen === 'true' || rawOpen === '1';

  return { pageNum, limitNum, status, openForPredictions };
}

export const getAllMatches = async (req: AuthRequest, res: Response) => {
  try {
    const { pageNum, limitNum, status, openForPredictions } = parseListQuery(req.query);

    const { matches, total } = await listMatches({
      status: openForPredictions ? undefined : status,
      openForPredictions,
      page: pageNum,
      limit: limitNum,
    });

    let enrichedMatches;
    try {
      enrichedMatches = await getEnrichedMatches(matches);
    } catch (enrichError) {
      logger.error('getEnrichedMatches', enrichError, { method: req.method, path: req.path });
      enrichedMatches = matches.map((m) => formatMatchForApi(m));
    }

    res.json({
      matches: enrichedMatches,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: limitNum > 0 ? Math.ceil(total / limitNum) : 0,
      },
    });
  } catch (error) {
    const errorDetails = logger.error('getAllMatches', error, { method: req.method, path: req.path });
    res.status(errorDetails.statusCode || 500).json({
      error: 'Failed to fetch matches',
      ...(process.env.NODE_ENV !== 'production'
        ? { details: errorDetails.message }
        : {}),
    });
  }
};

export const getLatestCompletedMatchTopEarners = async (req: AuthRequest, res: Response) => {
  try {
    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limitNum = Math.min(100, Math.max(1, parseInt(String(rawLimit ?? '50'), 10) || 50));

    const latest = await findLatestCompletedMatch();
    if (!latest) {
      return res.json({ match: null, earners: [] });
    }

    const match = await getEnrichedMatch(latest);
    const earners = await listTopEarnersForMatch(latest._id.toString(), limitNum);

    res.json({ match, earners });
  } catch (error) {
    const errorDetails = logger.error('getLatestCompletedMatchTopEarners', error, {
      method: req.method,
      path: req.path,
    });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to fetch latest match top earners' });
  }
};

export const getLiveMatchPredictions = async (_req: AuthRequest, res: Response) => {
  try {
    const groups = await listLiveMatchesWithPredictions();

    const matches = await Promise.all(
      groups.map(async ({ match, predictions }) => {
        let enrichedMatch;
        try {
          enrichedMatch = await getEnrichedMatch(match);
        } catch {
          enrichedMatch = formatMatchForApi(match);
        }

        return {
          match: enrichedMatch,
          predictions: predictions.map((p) => ({
            userId: p.userId,
            name: p.name,
            team1Score: p.team1Score,
            team2Score: p.team2Score,
            submittedTime: p.submittedTime,
            ...(p.comment ? { comment: p.comment } : {}),
          })),
        };
      })
    );

    res.json({ matches });
  } catch (error) {
    const errorDetails = logger.error('getLiveMatchPredictions', error, {
      method: 'GET',
      path: '/matches/live/predictions',
    });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to fetch live match predictions' });
  }
};

export const getMatchById = async (req: AuthRequest, res: Response) => {
  try {
    const match = await findMatchById(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(await getEnrichedMatch(match));
  } catch (error) {
    const errorDetails = logger.error('getMatchById', error, { matchId: req.params.matchId });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to fetch match' });
  }
};

export const createMatch = async (req: AuthRequest, res: Response) => {
  try {
    const { sequence, team1, team2, matchTime, predictionsEndingTime, round, group, matchTag, comment } = req.body;
    const resolvedMatchTag = matchTag || buildMatchTag(team1, team2);
    const { team1Info, team2Info } = await resolveTeamInfoForMatch(team1, team2);

    const match = await insertMatch({
      sequence,
      team1,
      team2,
      team1Info,
      team2Info,
      matchTime: new Date(matchTime),
      predictionsEndingTime: new Date(predictionsEndingTime),
      round,
      group,
      matchTag: resolvedMatchTag,
      comment,
      status: 'scheduled',
    });

    res.status(201).json({
      message: 'Match created successfully',
      match: formatMatchForApi(match),
    });
  } catch (error) {
    const errorDetails = logger.error('createMatch', error, { method: req.method, path: req.path });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to create match' });
  }
};

export const updateMatch = async (req: AuthRequest, res: Response) => {
  try {
    const {
      sequence,
      team1,
      team2,
      matchTime,
      predictionsEndingTime,
      round,
      group,
      matchTag,
      comment,
      team1Score,
      team2Score,
      status,
    } = req.body;

    const existing = await findMatchById(req.params.matchId);
    if (!existing) return res.status(404).json({ error: 'Match not found' });

    const nextTeam1 = team1 ?? existing.team1;
    const nextTeam2 = team2 ?? existing.team2;
    const teamInfo =
      team1 !== undefined || team2 !== undefined
        ? await resolveTeamInfoForMatch(nextTeam1, nextTeam2)
        : null;

    const updated = await updateMatchById(req.params.matchId, {
      ...(sequence !== undefined ? { sequence } : {}),
      ...(team1 !== undefined ? { team1 } : {}),
      ...(team2 !== undefined ? { team2 } : {}),
      ...(teamInfo?.team1Info ? { team1Info: teamInfo.team1Info } : {}),
      ...(teamInfo?.team2Info ? { team2Info: teamInfo.team2Info } : {}),
      ...(matchTime !== undefined ? { matchTime: new Date(matchTime) } : {}),
      ...(predictionsEndingTime !== undefined ? { predictionsEndingTime: new Date(predictionsEndingTime) } : {}),
      ...(round !== undefined ? { round } : {}),
      ...(group !== undefined ? { group } : {}),
      ...(comment !== undefined ? { comment } : {}),
      ...(team1Score !== undefined ? { team1Score } : {}),
      ...(team2Score !== undefined ? { team2Score } : {}),
      ...(status ? { status } : {}),
      ...((team1 !== undefined || team2 !== undefined || matchTag !== undefined)
        ? { matchTag: matchTag || buildMatchTag(nextTeam1, nextTeam2) }
        : {}),
    });

    res.json({
      message: 'Match updated successfully',
      match: formatMatchForApi(updated!),
    });
  } catch (error) {
    const errorDetails = logger.error('updateMatch', error, { matchId: req.params.matchId });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to update match' });
  }
};

export const deleteMatch = async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await deleteMatchById(req.params.matchId);
    if (!deleted) return res.status(404).json({ error: 'Match not found' });
    res.json({ message: 'Match deleted successfully' });
  } catch (error) {
    const errorDetails = logger.error('deleteMatch', error, { matchId: req.params.matchId });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to delete match' });
  }
};
