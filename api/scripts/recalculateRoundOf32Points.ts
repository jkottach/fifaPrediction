/**
 * Re-run scoring for completed Round of 32 matches (M73–M88) using legacy rules.
 *
 * Usage:
 *   MONGODB_DB=wc26Prod npm run recalculate:round-of-32-points
 */
import '../src/config/loadEnv';
import { connectMongo, disconnectMongo, getMatchesCollection } from '../src/lib/mongodb';
import { processMatchResults } from '../src/services/scoringService';
import {
  backfillAllPredictionSnapshots,
  clearRankTrendCache,
  recalculateAllUserTotalPoints,
} from '../src/db/repositories';

const R32_MIN = 73;
const R32_MAX = 88;

async function main() {
  await connectMongo();

  const matches = await getMatchesCollection()
    .find({
      status: 'completed',
      sequence: { $gte: R32_MIN, $lte: R32_MAX },
    })
    .sort({ sequence: 1 })
    .toArray();

  if (matches.length === 0) {
    throw new Error(`No completed Round of 32 matches (M${R32_MIN}–M${R32_MAX}) found.`);
  }

  console.log(`Recalculating ${matches.length} Round of 32 match(es)...`);

  for (const match of matches) {
    const label = `M${match.sequence} ${match.matchTag ?? `${match.team1} vs ${match.team2}`}`;
    await processMatchResults(match._id.toString());
    console.log(`  ${label}`);
  }

  const usersUpdated = await recalculateAllUserTotalPoints();
  const snapshotResult = await backfillAllPredictionSnapshots();
  clearRankTrendCache();

  console.log(
    `Done. ${matches.length} matches recalculated, ${usersUpdated} user total(s) synced, ` +
      `${snapshotResult.predictionsUpdated} prediction snapshot(s) updated.`
  );

  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
