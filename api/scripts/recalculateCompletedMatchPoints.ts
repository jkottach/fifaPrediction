/**
 * Re-run scoring for today's completed Canada vs Morocco match only.
 *
 * Run: npm run recalculate:match-points
 */
import '../src/config/loadEnv';
import { connectMongo, disconnectMongo, getMatchesCollection } from '../src/lib/mongodb';
import { processMatchResults } from '../src/services/scoringService';

function utcDayBounds(date = new Date()): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );
  return { start, end };
}

async function main() {
  await connectMongo();

  const { start, end } = utcDayBounds();
  const matchesCol = getMatchesCollection();

  const match = await matchesCol.findOne({
    team1: 'CAN',
    team2: 'MAR',
    status: 'completed',
    $or: [
      { matchTime: { $gte: start, $lte: end } },
      { updatedAt: { $gte: start, $lte: end } },
    ],
  });

  if (!match) {
    throw new Error(
      'No completed CAN vs MAR match found for today (UTC). ' +
        'Check team1=CAN, team2=MAR, status=completed, and matchTime/updatedAt.'
    );
  }

  await processMatchResults(match._id.toString());

  console.log(
    `Recalculated points for ${match.matchTag ?? 'CAN vs MAR'} (${match._id.toString()}).`
  );

  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
