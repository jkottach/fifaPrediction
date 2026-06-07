import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import {
  countUsersAhead,
  findUserById,
  listUsersByTotalPoints,
} from '../db/repositories';
import { formatUserId } from '../db/helpers';

function buildLeaderboardEntries(users: Awaited<ReturnType<typeof listUsersByTotalPoints>>) {
  return users
    .filter((user) => user._id)
    .map((user, index) => ({
      rank: index + 1,
      totalPoints: user.totalPoints ?? 0,
      name:
        `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
        user.email ||
        'User',
      state: user.state || '',
      userId: formatUserId(user),
      email: user.email ?? '',
    }));
}

export const getTopLeaderboard = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50' } = req.query;
    const limitNum = parseInt(limit as string, 10);
    const users = await listUsersByTotalPoints(limitNum);
    res.json({ leaderboard: buildLeaderboardEntries(users), source: 'mongodb' });
  } catch (error) {
    const errorDetails = logger.error('getTopLeaderboard', error, { path: req.path });
    res.status(errorDetails.statusCode || 500).json({
      error: 'Failed to fetch leaderboard',
      ...(process.env.NODE_ENV !== 'production' ? { details: errorDetails.message } : {}),
    });
  }
};

export const getUserStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ahead = await countUsersAhead(user.totalPoints);
    const rank = user.totalPoints > 0 ? ahead + 1 : '-';
    const stats = { rank, totalPoints: user.totalPoints };

    res.json({
      overall: stats,
      final: stats,
      daily: stats,
    });
  } catch (error) {
    const errorDetails = logger.error('getUserStats', error, { userId: req.user?.userId });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to fetch user stats' });
  }
};
