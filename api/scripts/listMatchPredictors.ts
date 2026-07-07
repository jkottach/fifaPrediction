import '../src/config/loadEnv';
import { MongoClient } from 'mongodb';
import { calculatePredictionPoints } from '../src/services/scoringService';
import { isKnockoutMatch, usesAdvancerKnockoutScoring, teamIdsEqual } from '../src/utils/knockout';
import type { MatchDocument, UserDocument } from '../src/db/types';

const SCORING = { correctPenaltyWinner: 2 };

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? 'wc26Prod');

  const match = await db.collection<MatchDocument>('matches').findOne({
    team1: 'MEX', team2: 'ENG', status: 'completed',
  });
  if (!match) throw new Error('match not found');
  const matchId = match._id.toString();

  const users = await db.collection<UserDocument>('users')
    .find({ 'predictions.matchId': matchId })
    .toArray();

  console.log(`M${match.sequence} ${match.team1} vs ${match.team2} actual ${match.team1Score}-${match.team2Score}`);
  console.log(`Round: ${match.round}, advancer: ${usesAdvancerKnockoutScoring(match)}`);
  console.log(`Predictors: ${users.length}\n`);

  for (const user of users) {
    const p = user.predictions.find((x) => x.matchId === matchId)!;
    const useAdvancer = usesAdvancerKnockoutScoring(match);
    const knockout = isKnockoutMatch(match) || (useAdvancer && p.team1Score === p.team2Score && !!p.penaltyWinner?.trim());
    let expected = calculatePredictionPoints(p.team1Score, p.team2Score, match.team1Score!, match.team2Score!, {
      isKnockout: knockout, useAdvancerScoring: useAdvancer,
      actualPenaltyWinner: match.penaltyWinner, predictedPenaltyWinner: p.penaltyWinner,
      team1: match.team1, team2: match.team2,
    });
    const isDraw = match.team1Score === match.team2Score;
    if (isDraw && p.team1Score === p.team2Score && match.penaltyWinner?.trim() && p.penaltyWinner?.trim() &&
        (useAdvancer ? teamIdsEqual(p.penaltyWinner, match.penaltyWinner!) : p.penaltyWinner === match.penaltyWinner)) {
      expected += SCORING.correctPenaltyWinner;
    }
    const stored = p.points ?? 0;
    const pen = p.penaltyWinner ? ` pen:${p.penaltyWinner}` : '';
    const flag = stored !== expected ? ' *** MISMATCH' : '';
    console.log(`${user.name} | pred ${p.team1Score}-${p.team2Score}${pen} | stored=${stored} expected=${expected}${flag}`);
  }
  await client.disconnect();
}
main();
