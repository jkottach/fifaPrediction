/**
 * One-time fix: round non-integer goal predictions (e.g. 0.1 → 0) and recalculate
 * points for completed matches.
 *
 * Run: npm run fix:decimal-goal-scores
 */
import '../src/config/loadEnv';
import { connectMongo, disconnectMongo, getUsersCollection, getMatchesCollection } from '../src/lib/mongodb';
import type { EmbeddedPrediction } from '../src/db/types';
import { computeUserTotalPoints } from '../src/db/helpers';
import { isIntegerGoalScore, normalizeGoalScore } from '../src/utils/goalScore';
import { processMatchResults } from '../src/services/scoringService';

function predictionNeedsFix(prediction: EmbeddedPrediction): boolean {
  return !isIntegerGoalScore(prediction.team1Score) || !isIntegerGoalScore(prediction.team2Score);
}

async function main() {
  await connectMongo();

  const usersCol = getUsersCollection();
  const matchesCol = getMatchesCollection();

  let usersUpdated = 0;
  let predictionsFixed = 0;

  const users = await usersCol.find({}).toArray();
  for (const user of users) {
    let changed = false;
    const nextPredictions = user.predictions.map((prediction) => {
      if (!predictionNeedsFix(prediction)) return prediction;

      changed = true;
      predictionsFixed += 1;
      return {
        ...prediction,
        team1Score: normalizeGoalScore(prediction.team1Score),
        team2Score: normalizeGoalScore(prediction.team2Score),
      };
    });

    if (!changed) continue;

    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          predictions: nextPredictions,
          totalPoints: computeUserTotalPoints({
            predictions: nextPredictions,
            tournamentPrediction: user.tournamentPrediction,
          }),
          updatedAt: new Date(),
        },
      }
    );
    usersUpdated += 1;
  }

  console.log(`Rounded ${predictionsFixed} prediction score(s) across ${usersUpdated} user(s).`);

  const completedMatches = await matchesCol
    .find({ status: 'completed' })
    .project({ _id: 1 })
    .toArray();

  let matchesRecalculated = 0;
  for (const match of completedMatches) {
    await processMatchResults(match._id.toString());
    matchesRecalculated += 1;
  }

  console.log(`Recalculated points for ${matchesRecalculated} completed match(es).`);

  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
