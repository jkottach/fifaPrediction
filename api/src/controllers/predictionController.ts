import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import {
  attachMatchToPredictions,
  findMatchById,
  findMatchesByIds,
  findUserById,
  updateUserById,
  upsertUserPrediction,
} from '../db/repositories';
import { formatUserId, sumPredictionPoints } from '../db/helpers';

export const submitPrediction = async (req: AuthRequest, res: Response) => {
  try {
    const { matchId, team1Score, team2Score, comment } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const match = await findMatchById(matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    if (new Date() > match.predictionsEndingTime) {
      return res.status(400).json({ error: 'Prediction deadline has passed' });
    }

    const userBefore = await findUserById(userId);
    const isUpdate = !!userBefore?.predictions.some((p) => p.matchId === matchId);

    const prediction = await upsertUserPrediction(userId, matchId, {
      matchTag: match.matchTag,
      team1Score,
      team2Score,
      comment,
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

async function listUserPredictions(
  req: AuthRequest,
  res: Response,
  options: { completedOnly: boolean }
) {
  try {
    const userId = req.user?.userId;
    const { matchId, page = '1', limit = '10' } = req.query;

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let predictions = [...user.predictions];
    if (matchId) {
      predictions = predictions.filter((p) => p.matchId === String(matchId));
    }

    const matchIds = [...new Set(predictions.map((p) => p.matchId))];
    const matches = await findMatchesByIds(matchIds);
    const matchById = new Map(matches.map((m) => [m._id.toString(), m]));

    if (options.completedOnly) {
      const completedMatchIds = new Set(
        matches.filter((m) => m.status === 'completed').map((m) => m._id.toString())
      );
      predictions = predictions.filter((p) => completedMatchIds.has(p.matchId));
    }

    predictions.sort((a, b) => {
      const matchA = matchById.get(a.matchId);
      const matchB = matchById.get(b.matchId);
      const timeA = matchA?.matchTime ? new Date(matchA.matchTime).getTime() : 0;
      const timeB = matchB?.matchTime ? new Date(matchB.matchTime).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return new Date(b.submittedTime).getTime() - new Date(a.submittedTime).getTime();
    });

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const total = predictions.length;
    const slice = predictions.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const populatedPredictions = await attachMatchToPredictions(user, slice);

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
}

export const getUserPredictions = async (req: AuthRequest, res: Response) => {
  return listUserPredictions(req, res, { completedOnly: false });
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
      team1Score: team1Score ?? existing.team1Score,
      team2Score: team2Score ?? existing.team2Score,
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
      totalPoints: sumPredictionPoints(predictions),
    });

    res.json({ message: 'Prediction deleted successfully' });
  } catch (error) {
    const errorDetails = logger.error('deletePrediction', error, { userId: req.user?.userId });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to delete prediction' });
  }
};

export const getUserPredictionsFromResults = async (req: AuthRequest, res: Response) => {
  return listUserPredictions(req, res, { completedOnly: true });
};
