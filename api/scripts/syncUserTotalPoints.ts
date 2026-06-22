/**
 * Recompute users.totalPoints = match points + tournament points for every user.
 *
 * Run: npm run sync:user-total-points
 */
import '../src/config/loadEnv';
import { connectMongo, disconnectMongo } from '../src/lib/mongodb';
import { recalculateAllUserTotalPoints } from '../src/db/repositories';

async function main() {
  await connectMongo();
  console.log('Syncing totalPoints for all users...');

  const updated = await recalculateAllUserTotalPoints();

  console.log(`Done. Updated ${updated} user(s).`);
  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
