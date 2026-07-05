/**
 * Audit R32 vs R16 scoring on a tenant DB.
 * Usage: MONGODB_DB=wc26Prod tsx scripts/auditRoundScoring.ts
 */
import '../src/config/loadEnv';
import { MongoClient } from 'mongodb';
import { calculatePredictionPoints } from '../src/services/scoringService';
import { isKnockoutMatch, isRoundOf32Match, usesAdvancerKnockoutScoring } from '../src/utils/knockout';
import type { MatchDocument, UserDocument } from '../src/db/types';

const SCORING = { correctPenaltyWinner: 5 };

function expectedPoints(match: MatchDocument, prediction: UserDocument['predictions'][number]): number {
  const useAdvancerScoring = usesAdvancerKnockoutScoring(match);
  const knockout =
    isKnockoutMatch(match) ||
    (useAdvancerScoring &&
      prediction.team1Score === prediction.team2Score &&
      !!prediction.penaltyWinner?.trim());

  let points = calculatePredictionPoints(
    prediction.team1Score,
    prediction.team2Score,
    match.team1Score!,
    match.team2Score!,
    {
      isKnockout: knockout,
      useAdvancerScoring,
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
    (useAdvancerScoring
      ? prediction.penaltyWinner.toUpperCase() === match.penaltyWinner.toUpperCase()
      : prediction.penaltyWinner === match.penaltyWinner)
  ) {
    points += SCORING.correctPenaltyWinner;
  }

  return points;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB ?? 'wc26Prod';
  if (!uri) throw new Error('MONGODB_URI not set');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const matches = await db
    .collection<MatchDocument>('matches')
    .find({ status: 'completed', sequence: { $gte: 73 } })
    .sort({ sequence: 1 })
    .toArray();

  const users = await db.collection<UserDocument>('users').find({ isActive: { $ne: false } }).toArray();

  console.log(`Round scoring audit for ${dbName}\n`);

  for (const match of matches) {
    const matchId = match._id.toString();
    let mismatches = 0;
    for (const user of users) {
      const prediction = user.predictions.find((p) => p.matchId === matchId);
      if (!prediction) continue;
      const stored = prediction.points ?? 0;
      const expected = expectedPoints(match, prediction);
      if (stored !== expected) mismatches += 1;
    }

    const round = usesAdvancerKnockoutScoring(match) ? 'R16+' : isRoundOf32Match(match) ? 'R32' : 'other';
    const status = mismatches === 0 ? 'OK' : `${mismatches} mismatch(es)`;
    console.log(`M${match.sequence} [${round}] ${match.matchTag ?? ''}: ${status}`);
  }

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
