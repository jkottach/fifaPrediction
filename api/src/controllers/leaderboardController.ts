import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import {
  computeRankTrendAfterLastGame,
  countDistinctPointTiersAhead,
  findUserById,
  listUsersByTotalPoints,
  type RankTrend,
} from '../db/repositories';
import { formatUserId } from '../db/helpers';
import type { UserDocument } from '../db/types';

function getLeaderboardName(user: UserDocument): string {
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'User';
}

function buildLeaderboardEntries(
  users: Awaited<ReturnType<typeof listUsersByTotalPoints>>,
  rankTrendByUserId: Map<string, RankTrend | null>
) {
  let denseRank = 0;
  let previousPoints: number | null = null;

  const sortedUsers = [...users]
    .filter((user) => user._id)
    .sort((a, b) => {
      const pointsDiff = (b.totalPoints ?? 0) - (a.totalPoints ?? 0);
      if (pointsDiff !== 0) return pointsDiff;
      return getLeaderboardName(a).localeCompare(getLeaderboardName(b), undefined, {
        sensitivity: 'base',
      });
    });

  return sortedUsers.map((user) => {
    const totalPoints = user.totalPoints ?? 0;
    if (previousPoints === null || totalPoints !== previousPoints) {
      denseRank += 1;
      previousPoints = totalPoints;
    }

    const userId = formatUserId(user);

    return {
      rank: denseRank,
      rankTrend: rankTrendByUserId.get(userId) ?? null,
      totalPoints,
      name: getLeaderboardName(user),
      state: user.state || '',
      userId,
      email: user.email ?? '',
    };
  });
}

export const getTopLeaderboard = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '30' } = req.query;
    const limitNum = parseInt(limit as string, 10);
    const [users, rankTrendByUserId] = await Promise.all([
      listUsersByTotalPoints(limitNum),
      computeRankTrendAfterLastGame(),
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({
      leaderboard: buildLeaderboardEntries(users, rankTrendByUserId),
      source: 'mongodb',
    });
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

    const tiersAhead = await countDistinctPointTiersAhead(user.totalPoints);
    const rank = user.totalPoints > 0 ? tiersAhead + 1 : '-';
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
