/**
 * Audit completed matches for missing or stale prediction points.
 *
 * Usage: tsx scripts/auditMatchPoints.ts
 */
import '../src/config/loadEnv';
import { MongoClient } from 'mongodb';
import { calculatePredictionPoints } from '../src/services/scoringService';
import { isKnockoutMatch } from '../src/utils/knockout';
import { computeUserTotalPoints } from '../src/db/helpers';
import type { MatchDocument, UserDocument } from '../src/db/types';

const DATABASES = ['wc26Prod', 'fifaPrediction', 'wc26Diva', 'wc26fcc', 'wcmandrake'];

const SCORING = { correctPenaltyWinner: 5 };

interface Mismatch {
  matchTag: string;
  matchId: string;
  sequence?: number;
  usersWithMismatch: number;
  unscored: number;
  stale: number;
}

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

async function auditDatabase(client: MongoClient, dbName: string) {
  const db = client.db(dbName);
  const matches = await db
    .collection<MatchDocument>('matches')
    .find({
      status: 'completed',
      team1Score: { $ne: null },
      team2Score: { $ne: null },
    })
    .sort({ sequence: 1 })
    .toArray();

  const users = await db
    .collection<UserDocument>('users')
    .find({ isActive: { $ne: false } })
    .toArray();

  const mismatches: Mismatch[] = [];
  let totalPointsDrift = 0;

  for (const match of matches) {
    const matchId = match._id.toString();
    let usersWithMismatch = 0;
    let unscored = 0;
    let stale = 0;

    for (const user of users) {
      const prediction = user.predictions.find((p) => p.matchId === matchId);
      if (!prediction) continue;

      const stored = prediction.points ?? 0;
      const expected = expectedPoints(match, prediction);

      if (stored !== expected) {
        usersWithMismatch += 1;
        if (stored === 0 && expected > 0) unscored += 1;
        else stale += 1;
      }
    }

    if (usersWithMismatch > 0) {
      mismatches.push({
        matchTag: match.matchTag ?? `${match.team1} vs ${match.team2}`,
        matchId,
        sequence: match.sequence,
        usersWithMismatch,
        unscored,
        stale,
      });
    }
  }

  for (const user of users) {
    const computed = computeUserTotalPoints(user);
    if (computed !== (user.totalPoints ?? 0)) totalPointsDrift += 1;
  }

  return { dbName, completedMatches: matches.length, mismatches, totalPointsDrift };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  const client = new MongoClient(uri);
  await client.connect();

  console.log('Auditing prediction points across tenant databases...\n');

  for (const dbName of DATABASES) {
    try {
      const result = await auditDatabase(client, dbName);
      console.log(`=== ${result.dbName} ===`);
      console.log(`Completed matches: ${result.completedMatches}`);
      console.log(`Users with totalPoints drift: ${result.totalPointsDrift}`);

      if (result.mismatches.length === 0) {
        console.log('No prediction point mismatches found.\n');
        continue;
      }

      console.log(`Matches needing recalculation: ${result.mismatches.length}`);
      for (const m of result.mismatches) {
        const seq = m.sequence != null ? `M${m.sequence}` : m.matchId.slice(-6);
        console.log(
          `  ${seq} ${m.matchTag}: ${m.usersWithMismatch} user(s) — ${m.unscored} likely unscored, ${m.stale} stale/wrong`
        );
      }
      console.log('');
    } catch (err) {
      console.error(`=== ${dbName} === ERROR:`, err instanceof Error ? err.message : err, '\n');
    }
  }

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
