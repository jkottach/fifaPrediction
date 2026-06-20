import type { Collection, Db } from 'mongodb';

interface SnapshotPrediction {
  matchId: string;
  points?: number;
  cumulativeTotalPoints?: number;
  overallRank?: number | null;
}

interface SnapshotUser {
  _id: { toString(): string };
  predictions: SnapshotPrediction[];
  tournamentPrediction?: { points?: number } | null;
  isActive?: boolean;
}

interface SnapshotMatch {
  _id: { toString(): string };
  matchTime: Date;
  sequence: number;
  status: string;
}

const activeUserFilter = {
  $or: [{ isActive: true }, { isActive: { $exists: false } }],
};

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

export async function applyPredictionSnapshotsAtMilestone(
  db: Db,
  usersCol: Collection<SnapshotUser>,
  matchId: string,
  completedMatchIds: Set<string>
): Promise<number> {
  const allUsers = await usersCol.find(activeUserFilter).toArray();

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

    const predictions = [...user.predictions];
    const cumulativeTotalPoints = totalByUserId.get(user._id.toString()) ?? 0;
    const overallRank = rankByUserId.get(user._id.toString()) ?? null;
    const tournamentPts = user.tournamentPrediction?.points ?? 0;

    predictions[idx] = {
      ...predictions[idx],
      cumulativeTotalPoints,
      overallRank,
    };

    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          predictions,
          totalPoints: cumulativeTotalPoints + tournamentPts,
          updatedAt: new Date(),
        },
      }
    );
    updated += 1;
  }

  return updated;
}

export async function applySnapshotsAfterMatchFinalized(
  db: Db,
  usersCol: Collection<SnapshotUser>,
  matchesCol: Collection<SnapshotMatch>,
  matchId: string
): Promise<void> {
  const completedMatches = await matchesCol
    .find({ status: 'completed' })
    .sort({ matchTime: 1, sequence: 1 })
    .toArray();
  const completedMatchIds = new Set(completedMatches.map((m) => m._id.toString()));
  await applyPredictionSnapshotsAtMilestone(db, usersCol, matchId, completedMatchIds);
}
