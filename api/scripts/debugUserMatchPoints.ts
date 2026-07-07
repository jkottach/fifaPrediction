/**
 * Debug a user's points for a specific match.
 * Usage: MONGODB_DB=wc26Prod npx tsx scripts/debugUserMatchPoints.ts "Abdul Majeed" MEX ENG
 */
import '../src/config/loadEnv';
import { MongoClient } from 'mongodb';
import { calculatePredictionPoints } from '../src/services/scoringService';
import {
  isKnockoutMatch,
  usesAdvancerKnockoutScoring,
  teamIdsEqual,
} from '../src/utils/knockout';
import type { MatchDocument, UserDocument } from '../src/db/types';

const SCORING = { correctPenaltyWinner: 2 };

function scorePrediction(match: MatchDocument, prediction: UserDocument['predictions'][number]) {
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
      ? teamIdsEqual(prediction.penaltyWinner, match.penaltyWinner)
      : prediction.penaltyWinner === match.penaltyWinner)
  ) {
    points += SCORING.correctPenaltyWinner;
  }

  return { points, useAdvancerScoring, knockout };
}

async function main() {
  const [nameQuery = 'Abdul Majeed', team1 = 'MEX', team2 = 'ENG'] = process.argv.slice(2);
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB ?? 'wc26Prod';
  if (!uri) throw new Error('MONGODB_URI not set');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const match = await db.collection<MatchDocument>('matches').findOne({
    team1,
    team2,
    status: 'completed',
  });

  if (!match) {
    console.error(`No completed ${team1} vs ${team2} match found in ${dbName}`);
    process.exit(1);
  }

  const matchId = match._id.toString();
  const users = await db
    .collection<UserDocument>('users')
    .find({
      $or: [
        { name: { $regex: nameQuery, $options: 'i' } },
        { email: { $regex: nameQuery, $options: 'i' } },
      ],
    })
    .toArray();

  console.log(`DB: ${dbName}`);
  console.log(`Match: M${match.sequence} ${match.matchTag} [${match.round}]`);
  console.log(`Teams: ${match.team1} vs ${match.team2}`);
  console.log(
    `Actual: ${match.team1Score}-${match.team2Score}` +
      (match.penaltyWinner ? ` (pen: ${match.penaltyWinner})` : '')
  );
  console.log(`Status: ${match.status}`);
  console.log(`Advancer scoring: ${usesAdvancerKnockoutScoring(match)}`);
  console.log(`Match ID: ${matchId}`);
  console.log('');

  if (users.length === 0) {
    console.log(`No user matching "${nameQuery}"`);
    await client.disconnect();
    return;
  }

  for (const user of users) {
    const prediction = user.predictions.find((p) => p.matchId === matchId);
    console.log(`User: ${user.name} <${user.email}>`);
    if (!prediction) {
      console.log('  No prediction for this match');
      console.log('');
      continue;
    }

    const predPen = prediction.penaltyWinner ? ` (pen: ${prediction.penaltyWinner})` : '';
    const { points: expected, useAdvancerScoring, knockout } = scorePrediction(match, prediction);

    console.log(`  Predicted: ${prediction.team1Score}-${prediction.team2Score}${predPen}`);
    console.log(`  Stored points: ${prediction.points ?? 0}`);
    console.log(`  Expected points (current code): ${expected}`);
    console.log(`  useAdvancerScoring=${useAdvancerScoring}, knockout=${knockout}`);
    console.log(`  prediction.matchId: ${prediction.matchId}`);
    console.log('');
  }

  await client.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
