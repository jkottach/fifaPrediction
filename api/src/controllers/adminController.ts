import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import { finalizeMatchScores } from '../services/scoringService';
import { formatMatchForApi, formatUserId } from '../db/helpers';
import { deleteUserById, findUserById } from '../db/repositories';
import { getUsersCollection } from '../lib/mongodb';

export const getCommunityRequests = async (_req: AuthRequest, res: Response) => {
  res.json({ requests: [] });
};

export const approveCommunity = async (_req: AuthRequest, res: Response) => {
  res.status(410).json({ error: 'Community features are disabled' });
};

export const createAndApproveCommunity = async (_req: AuthRequest, res: Response) => {
  res.status(410).json({ error: 'Community features are disabled' });
};

export const rejectCommunity = async (_req: AuthRequest, res: Response) => {
  res.status(410).json({ error: 'Community features are disabled' });
};

export const finalizeMatch = async (req: AuthRequest, res: Response) => {
  try {
    const { matchId, team1Score, team2Score, penaltyWinner } = req.body;
    if (team1Score === undefined || team2Score === undefined) {
      return res.status(400).json({ error: 'Both team scores are required' });
    }

    const updated = await finalizeMatchScores(
      String(matchId),
      team1Score,
      team2Score,
      penaltyWinner ?? null
    );

    res.json({
      message: 'Match finalized and points calculated successfully',
      match: formatMatchForApi(updated),
    });
  } catch (error) {
    const errorDetails = logger.error('finalizeMatch', error, { matchId: req.body?.matchId });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to finalize match' });
  }
};

export const getAllUsers = async (_req: AuthRequest, res: Response) => {
  try {
    const users = await getUsersCollection().find({}).sort({ createdAt: -1 }).toArray();
    res.json({
      users: users.map((u) => ({
        userId: formatUserId(u),
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        totalPoints: u.totalPoints,
        predictionCount: u.predictions.length,
        isActive: u.isActive,
      })),
    });
  } catch (error) {
    const errorDetails = logger.error('getAllUsers', error);
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to fetch users' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const target = await findUserById(req.params.userId);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'admin') return res.status(400).json({ error: 'Cannot delete admin users' });

    await deleteUserById(req.params.userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    const errorDetails = logger.error('deleteUser', error, { userId: req.params.userId });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to delete user' });
  }
};
