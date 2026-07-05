/**
 * Re-run scoring for the completed Canada vs Morocco match only.
 *
 * Run: npm run recalculate:match-points
 */
import '../src/config/loadEnv';
import { connectMongo, disconnectMongo, getMatchesCollection } from '../src/lib/mongodb';
import { processMatchResults } from '../src/services/scoringService';

async function main() {
  await connectMongo();

  const match = await getMatchesCollection().findOne({
    team1: 'CAN',
    team2: 'MAR',
    status: 'completed',
  });

  if (!match) {
    throw new Error(
      'No completed CAN vs MAR match found. Check team1=CAN, team2=MAR, status=completed.'
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
