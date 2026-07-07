/**
 * Audit M90 prediction points across tenant databases.
 * Usage: tsx scripts/auditM90Points.ts
 */
import '../src/config/loadEnv';
import { MongoClient } from 'mongodb';
import { calculatePredictionPoints } from '../src/services/scoringService';
import { isKnockoutMatch } from '../src/utils/knockout';
import type { MatchDocument, UserDocument } from '../src/db/types';

const DATABASES = ['wc26Prod', 'fifaPrediction', 'wc26Diva', 'wc26fcc', 'wcmandrake'];
const SCORING = { correctPenaltyWinner: 2 };

function expectedPoints(
  match: MatchDocument,
  prediction: UserDocument['predictions'][number]
): number {
  const knockout =
    isKnockoutMatch(match) ||
    (prediction.team1Score === prediction.team2Score && !!prediction.penaltyWinner?.trim());

  let points = calculatePredictionPoints(
    prediction.team1Score,
    prediction.team2Score,
    match.team1Score!,
    match.team2Score!,
    {
      isKnockout: knockout,
      actualPenaltyWinner: match.penaltyWinner ?? null,
      predictedPenaltyWinner: prediction.penaltyWinner ?? null,
      team1: match.team1,
      team2: match.team2,
    }
  );

  const isDraw = match.team1Score === match.team2Score;
  if (
    isDraw &&
    prediction.team1Score === prediction.team2Score &&
    match.penaltyWinner?.trim() &&
    prediction.penaltyWinner?.trim() &&
    prediction.penaltyWinner === match.penaltyWinner
  ) {
    points += SCORING.correctPenaltyWinner;
  }

  return points;
}

async function auditM90(client: MongoClient, dbName: string) {
  const db = client.db(dbName);
  const match = await db.collection<MatchDocument>('matches').findOne({ sequence: 90 });

  if (!match) {
    return { dbName, found: false as const };
  }

  const matchId = match._id.toString();
  const users = await db
    .collection<UserDocument>('users')
    .find({ isActive: { $ne: false }, 'predictions.matchId': matchId })
    .toArray();

  const rows: Array<{
    user: string;
    predicted: string;
    stored: number;
    expected: number;
    ok: boolean;
  }> = [];

  for (const user of users) {
    const prediction = user.predictions.find((p) => p.matchId === matchId);
    if (!prediction) continue;

    const stored = prediction.points ?? 0;
    const expected = expectedPoints(match, prediction);
    const predScore = `${prediction.team1Score}-${prediction.team2Score}`;
    const pen = prediction.penaltyWinner ? ` (pen: ${prediction.penaltyWinner})` : '';

    rows.push({
      user: user.name ?? user.email ?? user._id.toString(),
      predicted: predScore + pen,
      stored,
      expected,
      ok: stored === expected,
    });
  }

  const mismatches = rows.filter((r) => !r.ok);

  return {
    dbName,
    found: true as const,
    matchTag: match.matchTag ?? `${match.team1} vs ${match.team2}`,
    status: match.status,
    actual: `${match.team1Score}-${match.team2Score}`,
    penaltyWinner: match.penaltyWinner ?? null,
    predictors: rows.length,
    mismatches,
    allOk: mismatches.length === 0,
  };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  const client = new MongoClient(uri);
  await client.connect();

  console.log('M90 audit across tenant databases\n');

  for (const dbName of DATABASES) {
    const result = await auditM90(client, dbName);

    console.log(`=== ${result.dbName} ===`);
    if (!result.found) {
      console.log('M90 not found.\n');
      continue;
    }

    console.log(`Match: ${result.matchTag} (${result.status})`);
    console.log(`Actual: ${result.actual}${result.penaltyWinner ? ` (pen: ${result.penaltyWinner})` : ''}`);
    console.log(`Predictors: ${result.predictors}`);

    if (result.allOk) {
      console.log('All prediction points correct.\n');
      continue;
    }

    console.log(`Needs recalculation: ${result.mismatches.length} user(s)`);
    for (const m of result.mismatches) {
      console.log(`  ${m.user}: predicted ${m.predicted}, stored=${m.stored}, expected=${m.expected}`);
    }
    console.log('');
  }

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
