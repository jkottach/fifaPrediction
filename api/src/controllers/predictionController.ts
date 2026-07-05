import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import {
  attachMatchToPredictions,
  computeOverallRankByPredictionId,
  findMatchById,
  findUserById,
  updateUserById,
  upsertUserPrediction,
} from '../db/repositories';
import { formatUserId, computeUserTotalPoints } from '../db/helpers';
import { isKnockoutMatch, resolveCanonicalTeamId } from '../utils/knockout';
import { normalizeGoalScore } from '../utils/goalScore';

type PopulatedPrediction = Awaited<ReturnType<typeof attachMatchToPredictions>>[number];
type MatchScheduleRef = { matchTime?: string | Date; sequence?: number };

function comparePredictionsBySchedule(
  a: PopulatedPrediction,
  b: PopulatedPrediction,
  direction: 'asc' | 'desc' = 'asc'
): number {
  const matchA = a.matchId as MatchScheduleRef | null;
  const matchB = b.matchId as MatchScheduleRef | null;
  const timeA = matchA?.matchTime ? new Date(matchA.matchTime).getTime() : 0;
  const timeB = matchB?.matchTime ? new Date(matchB.matchTime).getTime() : 0;
  if (timeA !== timeB) return direction === 'asc' ? timeA - timeB : timeB - timeA;
  const seqA = matchA?.sequence ?? 0;
  const seqB = matchB?.sequence ?? 0;
  return direction === 'asc' ? seqA - seqB : seqB - seqA;
}

export const submitPrediction = async (req: AuthRequest, res: Response) => {
  try {
    const { matchId, team1Score, team2Score, comment, penaltyWinner } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const match = await findMatchById(matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    if (new Date() > match.predictionsEndingTime) {
      return res.status(400).json({ error: 'Prediction deadline has passed' });
    }

    const userBefore = await findUserById(userId);
    const isUpdate = !!userBefore?.predictions.some((p) => p.matchId === matchId);

    const normalizedTeam1Score = normalizeGoalScore(team1Score);
    const normalizedTeam2Score = normalizeGoalScore(team2Score);

    let resolvedPenaltyWinner: string | null = null;
    if (isKnockoutMatch(match) && normalizedTeam1Score === normalizedTeam2Score) {
      const pick = String(penaltyWinner ?? '').trim();
      const canonical = pick ? resolveCanonicalTeamId(pick, match.team1, match.team2) : null;
      if (!canonical) {
        return res.status(400).json({
          error: 'Pick who wins the penalty shootout when predicting a draw in a knockout match',
        });
      }
      resolvedPenaltyWinner = canonical;
    }

    const prediction = await upsertUserPrediction(userId, matchId, {
      matchTag: match.matchTag,
      team1Score: normalizedTeam1Score,
      team2Score: normalizedTeam2Score,
      comment,
      penaltyWinner: resolvedPenaltyWinner,
      submittedTime: new Date(),
    });

    res.status(isUpdate ? 200 : 201).json({
      message: isUpdate ? 'Prediction updated successfully' : 'Prediction submitted successfully',
      prediction,
    });
  } catch (error) {
    const errorDetails = logger.error('submitPrediction', error, { userId: req.user?.userId });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to submit prediction' });
  }
};

export const getUserPredictions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { matchId, page = '1', limit = '10', minimal } = req.query;
    const minimalResponse = minimal === 'true' || minimal === '1';

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let predictions = [...user.predictions];
    if (matchId) {
      predictions = predictions.filter((p) => p.matchId === String(matchId));
    }

    predictions.sort((a, b) => new Date(b.submittedTime).getTime() - new Date(a.submittedTime).getTime());

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const total = predictions.length;
    const slice = predictions.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const populatedPredictions = minimalResponse
      ? slice.map((prediction) => ({
          ...prediction,
          _id: prediction.matchId,
          userId,
          matchId: prediction.matchId,
        }))
      : await attachMatchToPredictions(user, slice);

    if (!minimalResponse) {
      populatedPredictions.sort((a, b) => {
        const matchA = a.matchId as { matchTime?: string | Date } | null;
        const matchB = b.matchId as { matchTime?: string | Date } | null;
        const timeA = matchA?.matchTime ? new Date(matchA.matchTime).getTime() : 0;
        const timeB = matchB?.matchTime ? new Date(matchB.matchTime).getTime() : 0;
        return timeB - timeA;
      });
    }

    res.json({
      predictions: populatedPredictions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    const errorDetails = logger.error('getUserPredictions', error, { userId: req.user?.userId });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to fetch predictions' });
  }
};

export const updatePrediction = async (req: AuthRequest, res: Response) => {
  try {
    const { predictionId } = req.params;
    const { team1Score, team2Score, comment } = req.body;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const matchId = predictionId.includes('_') ? predictionId.split('_').slice(1).join('_') : predictionId;
    const existing = user.predictions.find((p) => p.matchId === matchId || `${formatUserId(user)}_${p.matchId}` === predictionId);
    if (!existing) return res.status(404).json({ error: 'Prediction not found' });

    const match = await findMatchById(existing.matchId);
    if (match && new Date() > match.predictionsEndingTime) {
      return res.status(400).json({ error: 'Cannot update prediction after deadline' });
    }

    const updated = await upsertUserPrediction(userId, existing.matchId, {
      matchTag: existing.matchTag,
      team1Score: team1Score !== undefined ? normalizeGoalScore(team1Score) : existing.team1Score,
      team2Score: team2Score !== undefined ? normalizeGoalScore(team2Score) : existing.team2Score,
      comment: comment ?? existing.comment,
      points: existing.points,
      submittedTime: new Date(),
    });

    res.json({ message: 'Prediction updated successfully', prediction: updated });
  } catch (error) {
    const errorDetails = logger.error('updatePrediction', error, { userId: req.user?.userId });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to update prediction' });
  }
};

export const deletePrediction = async (req: AuthRequest, res: Response) => {
  try {
    const { predictionId } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const matchId = predictionId.includes('_') ? predictionId.split('_').slice(1).join('_') : predictionId;
    const existing = user.predictions.find((p) => p.matchId === matchId);
    if (!existing) return res.status(404).json({ error: 'Prediction not found' });

    const match = await findMatchById(existing.matchId);
    if (match && new Date() > match.predictionsEndingTime) {
      return res.status(400).json({ error: 'Cannot delete prediction after deadline' });
    }

    const predictions = user.predictions.filter((p) => p.matchId !== existing.matchId);
    await updateUserById(userId, {
      predictions,
      totalPoints: computeUserTotalPoints({
        predictions,
        tournamentPrediction: user.tournamentPrediction,
      }),
    });

    res.json({ message: 'Prediction deleted successfully' });
  } catch (error) {
    const errorDetails = logger.error('deletePrediction', error, { userId: req.user?.userId });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to delete prediction' });
  }
};

async function buildPredictionsFromResults(
  userId: string,
  page: string | number = '1',
  limit: string | number = '10'
) {
  const user = await findUserById(userId);
  if (!user) return null;

  const populatedPredictions = await attachMatchToPredictions(user, [...user.predictions]);

  const completedPredictions = populatedPredictions.filter((prediction) => {
    const match = prediction.matchId as { status?: string } | null;
    return match?.status === 'completed';
  });

  completedPredictions.sort((a, b) => comparePredictionsBySchedule(a, b, 'desc'));

  const pageNum = parseInt(String(page), 10);
  const limitNum = parseInt(String(limit), 10);
  const total = completedPredictions.length;
  const slice = completedPredictions.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  const chronoSorted = [...completedPredictions].sort((a, b) =>
    comparePredictionsBySchedule(a, b, 'asc')
  );

  let runningTotal = 0;
  const cumulativeFallbackById = new Map<string, number>();
  for (const prediction of chronoSorted) {
    runningTotal += prediction.points ?? 0;
    cumulativeFallbackById.set(String(prediction.id), runningTotal);
  }

  const needsRankFallback = completedPredictions.some(
    (p) => (p as { overallRank?: number | null }).overallRank == null
  );
  const rankFallback = needsRankFallback
    ? await computeOverallRankByPredictionId(userId)
    : new Map<string, number | null>();

  const resolveRank = (predictionId: string, stored?: number | null) =>
    stored ?? rankFallback.get(predictionId) ?? null;

  let previousRank: number | null = null;
  const previousRankByPredictionId = new Map<string, number | null>();
  for (const prediction of chronoSorted) {
    const predictionId = String(prediction.id);
    previousRankByPredictionId.set(predictionId, previousRank);
    const currentRank = resolveRank(
      predictionId,
      (prediction as { overallRank?: number | null }).overallRank
    );
    if (currentRank != null) {
      previousRank = currentRank;
    }
  }

  const predictionsWithMeta = slice.map((prediction) => {
    const predictionId = String(prediction.id);
    const storedTotal = (prediction as { cumulativeTotalPoints?: number }).cumulativeTotalPoints;
    const storedRank = (prediction as { overallRank?: number | null }).overallRank;
    const overallRank = resolveRank(predictionId, storedRank);

    return {
      ...prediction,
      totalPoints: cumulativeFallbackById.get(predictionId) ?? storedTotal ?? 0,
      overallRank,
      previousOverallRank: previousRankByPredictionId.get(predictionId) ?? null,
    };
  });

  return {
    predictions: predictionsWithMeta,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
}

export const getUserPredictionsFromResults = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { page = '1', limit = '10' } = req.query;

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const result = await buildPredictionsFromResults(userId, page as string, limit as string);
    if (!result) return res.status(404).json({ error: 'User not found' });

    res.json(result);
  } catch (error) {
    const errorDetails = logger.error('getUserPredictionsFromResults', error, {
      userId: req.user?.userId,
    });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to fetch predictions' });
  }
};

export const getUserPredictionsFromResultsByUserId = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated' });

    const targetUserId = String(req.params.userId ?? '').trim();
    if (!targetUserId) return res.status(400).json({ error: 'User id is required' });

    const { page = '1', limit = '10' } = req.query;
    const result = await buildPredictionsFromResults(targetUserId, page as string, limit as string);
    if (!result) return res.status(404).json({ error: 'User not found' });

    res.json(result);
  } catch (error) {
    const errorDetails = logger.error('getUserPredictionsFromResultsByUserId', error, {
      userId: req.user?.userId,
      targetUserId: req.params.userId,
    });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to fetch predictions' });
  }
};
