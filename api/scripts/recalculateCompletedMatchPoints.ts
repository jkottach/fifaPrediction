/**
 * Re-run scoring for all completed matches (e.g. after scoring rule changes).
 *
 * Run: npm run recalculate:match-points
 */
import '../src/config/loadEnv';
import { connectMongo, disconnectMongo, getMatchesCollection } from '../src/lib/mongodb';
import { processMatchResults } from '../src/services/scoringService';

async function main() {
  await connectMongo();

  const completedMatches = await getMatchesCollection()
    .find({ status: 'completed' })
    .project({ _id: 1, matchTag: 1 })
    .toArray();

  let recalculated = 0;
  for (const match of completedMatches) {
    await processMatchResults(match._id.toString());
    recalculated += 1;
    console.log(`Recalculated: ${match.matchTag ?? match._id.toString()}`);
  }

  console.log(`Done — recalculated points for ${recalculated} completed match(es).`);
  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
