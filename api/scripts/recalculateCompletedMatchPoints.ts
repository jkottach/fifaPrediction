/**
 * Re-run scoring for a completed match using current scoring rules.
 *
 * Usage:
 *   npm run recalculate:match-points
 *   npm run recalculate:match-points -- NED MAR
 */
import '../src/config/loadEnv';
import { connectMongo, disconnectMongo, getMatchesCollection } from '../src/lib/mongodb';
import { processMatchResults } from '../src/services/scoringService';
import { recalculateUserTotalPoints, clearRankTrendCache } from '../src/db/repositories';

async function main() {
  const [team1 = 'NED', team2 = 'MAR'] = process.argv.slice(2);

  await connectMongo();

  const match = await getMatchesCollection().findOne({
    team1,
    team2,
    status: 'completed',
  });

  if (!match) {
    throw new Error(
      `No completed ${team1} vs ${team2} match found. Pass teams: npm run recalculate:match-points -- NED MAR`
    );
  }

  await processMatchResults(match._id.toString());

  const usersCol = (await import('../src/lib/mongodb')).getUsersCollection();
  const users = await usersCol
    .find({ 'predictions.matchId': match._id.toString() })
    .project({ _id: 1 })
    .toArray();

  for (const user of users) {
    await recalculateUserTotalPoints(user._id.toString());
  }

  clearRankTrendCache();

  console.log(
    `Recalculated points for ${match.matchTag ?? `${team1} vs ${team2}`} (${match._id.toString()}), ${users.length} user(s) synced.`
  );

  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
