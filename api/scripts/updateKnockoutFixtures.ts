/**
 * Apply resolved Round of 32 teams from worldCup2026.seed.json to existing matches
 * by sequence number — preserves match _ids and user predictions.
 *
 * Usage:
 *   npm run update:knockout-fixtures
 *   npm run update:knockout-fixtures -- wc26Prod fifaPrediction
 *   MONGODB_DBS=wc26Prod,fifaPrediction npm run update:knockout-fixtures
 */
import '../src/config/loadEnv';
import { connectMongo, disconnectMongo, getMatchesCollection } from '../src/lib/mongodb';
import { resolveTeamInfoForMatch } from '../src/db/repositories';
import { loadWorldCup2026Seed, validateSeedData, type SeedMatch } from './data/worldCup2026Seed';

const ROUND_OF_32_MIN = 73;
const ROUND_OF_32_MAX = 88;

const DEFAULT_DATABASES = [
  'wc26Prod',
  'fifaPrediction',
  'wc26Diva',
  'wc26fcc',
  'wcmandrake',
];

function resolveTargetDatabases(): string[] {
  const cliArgs = process.argv.slice(2).filter(Boolean);
  if (cliArgs.length > 0) return cliArgs;

  const fromEnv = process.env.MONGODB_DBS?.split(',').map((name) => name.trim()).filter(Boolean);
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  return DEFAULT_DATABASES;
}

async function updateDatabase(dbName: string, knockoutFixtures: SeedMatch[]): Promise<void> {
  process.env.MONGODB_DB = dbName;
  await disconnectMongo();
  await connectMongo();

  const matchesCol = getMatchesCollection();
  const now = new Date();
  let updated = 0;
  let skipped = 0;

  console.log(`\n=== ${dbName} ===`);

  for (const fixture of knockoutFixtures) {
    const existing = await matchesCol.findOne({ sequence: fixture.sequence });
    if (!existing) {
      console.warn(`  M${fixture.sequence}: no match in DB — skipped`);
      skipped += 1;
      continue;
    }

    if (existing.status === 'completed') {
      console.warn(`  M${fixture.sequence}: already completed — skipped`);
      skipped += 1;
      continue;
    }

    const teamInfo = await resolveTeamInfoForMatch(fixture.team1, fixture.team2);

    const result = await matchesCol.updateOne(
      { _id: existing._id },
      {
        $set: {
          team1: fixture.team1,
          team2: fixture.team2,
          team1Info: teamInfo.team1Info,
          team2Info: teamInfo.team2Info,
          matchTag: fixture.matchTag,
          matchTime: new Date(fixture.matchTime),
          predictionsEndingTime: new Date(fixture.predictionsEndingTime),
          updatedAt: now,
        },
      }
    );

    if (result.modifiedCount === 1) {
      updated += 1;
      console.log(`  M${fixture.sequence}: ${fixture.team1} vs ${fixture.team2}`);
    } else {
      console.log(`  M${fixture.sequence}: unchanged`);
    }
  }

  console.log(`  Done. Updated ${updated}, skipped ${skipped}.`);
}

async function main() {
  const seed = loadWorldCup2026Seed();
  validateSeedData(seed);

  const knockoutFixtures = seed.matches.filter(
    (match) => match.sequence >= ROUND_OF_32_MIN && match.sequence <= ROUND_OF_32_MAX
  );

  if (knockoutFixtures.length !== ROUND_OF_32_MAX - ROUND_OF_32_MIN + 1) {
    throw new Error(`Expected 16 Round of 32 fixtures, found ${knockoutFixtures.length}`);
  }

  const databases = resolveTargetDatabases();
  console.log(`Updating Round of 32 in: ${databases.join(', ')}`);

  for (const dbName of databases) {
    await updateDatabase(dbName, knockoutFixtures);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => disconnectMongo());
