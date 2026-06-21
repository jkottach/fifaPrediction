/**
 * One-time backfill: persist cumulativeTotalPoints + overallRank on each embedded
 * prediction for all completed matches (chronological replay).
 *
 * Run: npm run backfill:prediction-snapshots
 */
import '../src/config/loadEnv';
import { connectMongo, disconnectMongo } from '../src/lib/mongodb';
import { backfillAllPredictionSnapshots } from '../src/db/repositories';

async function main() {
  await connectMongo();
  console.log('Backfilling prediction snapshots for completed matches...');

  const result = await backfillAllPredictionSnapshots();

  console.log(
    `Done. Processed ${result.matchesProcessed} matches, updated ${result.predictionsUpdated} user predictions.`
  );

  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
