/**
 * Re-run scoring for completed Round of 16+ matches (M89+) using advancer rules.
 *
 * Usage:
 *   MONGODB_DB=wc26Prod npm run recalculate:round-of-16-points
 */
import '../src/config/loadEnv';
import { connectMongo, disconnectMongo, getMatchesCollection } from '../src/lib/mongodb';
import { processMatchResults } from '../src/services/scoringService';
import {
  backfillAllPredictionSnapshots,
  clearRankTrendCache,
  recalculateAllUserTotalPoints,
} from '../src/db/repositories';

const R16_MIN = 89;

async function main() {
  await connectMongo();

  const matches = await getMatchesCollection()
    .find({
      status: 'completed',
      sequence: { $gte: R16_MIN },
    })
    .sort({ sequence: 1 })
    .toArray();

  if (matches.length === 0) {
    throw new Error(`No completed Round of 16+ matches (M${R16_MIN}+) found.`);
  }

  console.log(`Recalculating ${matches.length} Round of 16+ match(es)...`);

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
