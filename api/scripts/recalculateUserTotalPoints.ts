/**
 * Recompute users.totalPoints = match prediction points + tournament points.
 * Run after deploy if leaderboard totals look inconsistent.
 *
 *   cd api && npm run recalculate:points
 */
import 'dotenv/config';
import { connectMongo } from '../src/lib/mongodb';
import { recalculateAllUserTotalPoints } from '../src/db/repositories';

async function main() {
  await connectMongo();
  const updated = await recalculateAllUserTotalPoints();
  console.log(`Updated totalPoints for ${updated} user(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
