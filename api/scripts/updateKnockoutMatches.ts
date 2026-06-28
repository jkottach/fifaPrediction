/**
 * Update specific knockout fixtures by sequence (preserves match _ids).
 *
 * Usage: npm run update:knockout-matches -- 84 85
 */
import '../src/config/loadEnv';
import { connectMongo, disconnectMongo, getMatchesCollection } from '../src/lib/mongodb';
import { resolveTeamInfoForMatch } from '../src/db/repositories';
import { loadWorldCup2026Seed, validateSeedData } from './data/worldCup2026Seed';

const DEFAULT_DATABASES = [
  'wc26Prod',
  'fifaPrediction',
  'wc26Diva',
  'wc26fcc',
  'wcmandrake',
];

async function main() {
  const sequences = process.argv.slice(2).map((arg) => parseInt(arg, 10)).filter((n) => !Number.isNaN(n));
  if (sequences.length === 0) {
    throw new Error('Pass at least one match sequence, e.g. npm run update:knockout-matches -- 84 85');
  }

  const seed = loadWorldCup2026Seed();
  validateSeedData(seed);

  const fixtures = seed.matches.filter((match) => sequences.includes(match.sequence));
  if (fixtures.length === 0) {
    throw new Error(`No fixtures found in seed for sequences: ${sequences.join(', ')}`);
  }

  console.log(`Updating M${sequences.join(', M')} in: ${DEFAULT_DATABASES.join(', ')}`);

  for (const dbName of DEFAULT_DATABASES) {
    process.env.MONGODB_DB = dbName;
    await disconnectMongo();
    await connectMongo();

    const matchesCol = getMatchesCollection();
    const now = new Date();

    console.log(`\n=== ${dbName} ===`);

    for (const fixture of fixtures) {
      const existing = await matchesCol.findOne({ sequence: fixture.sequence });
      if (!existing) {
        console.warn(`  M${fixture.sequence}: no match in DB — skipped`);
        continue;
      }

      if (existing.status === 'completed') {
        console.warn(`  M${fixture.sequence}: already completed — skipped`);
        continue;
      }

      const teamInfo = await resolveTeamInfoForMatch(fixture.team1, fixture.team2);

      await matchesCol.updateOne(
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

      console.log(`  M${fixture.sequence}: ${fixture.team1} vs ${fixture.team2}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => disconnectMongo());
