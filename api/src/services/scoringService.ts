import {
  findMatchById,
  findUsersWithPredictionForMatch,
  updateMatchById,
  updatePredictionPointsForMatch,
  applySnapshotsAfterMatchFinalized,
} from '../db/repositories';
import { isKnockoutMatch } from '../utils/knockout';

interface ScoringCriteria {
  correctResult: number;
  correctTeam1Score: number;
  correctTeam2Score: number;
  correctGoalDifference: number;
  correctPenaltyWinner: number;
}

const SCORING: ScoringCriteria = {
  correctResult: 5,
  correctTeam1Score: 2,
  correctTeam2Score: 2,
  correctGoalDifference: 1,
  correctPenaltyWinner: 2,
};

/**
 * Determines the final match outcome as 1 (team1 wins), -1 (team2 wins), or 0 (draw).
 * For knockout matches, penalties decide the winner — there is no draw.
 */
function getFinalOutcome(
  team1Score: number,
  team2Score: number,
  opts?: { isKnockout?: boolean; penaltyWinner?: string | null; team1?: string; team2?: string }
): 1 | -1 | 0 {
  if (team1Score > team2Score) return 1;
  if (team1Score < team2Score) return -1;

  if (opts?.isKnockout && opts.penaltyWinner) {
    if (opts.penaltyWinner === opts.team1) return 1;
    if (opts.penaltyWinner === opts.team2) return -1;
  }

  return 0;
}

export interface CalculatePointsOptions {
  isKnockout?: boolean;
  actualPenaltyWinner?: string | null;
  predictedPenaltyWinner?: string | null;
  team1?: string;
  team2?: string;
}

export const calculatePredictionPoints = (
  predictedTeam1: number,
  predictedTeam2: number,
  actualTeam1: number,
  actualTeam2: number,
  opts?: CalculatePointsOptions
): number => {
  let points = 0;

  const predictedOutcome = getFinalOutcome(predictedTeam1, predictedTeam2, {
    isKnockout: opts?.isKnockout,
    penaltyWinner: opts?.predictedPenaltyWinner,
    team1: opts?.team1,
    team2: opts?.team2,
  });

  const actualOutcome = getFinalOutcome(actualTeam1, actualTeam2, {
    isKnockout: opts?.isKnockout,
    penaltyWinner: opts?.actualPenaltyWinner,
    team1: opts?.team1,
    team2: opts?.team2,
  });

  if (predictedOutcome === actualOutcome) {
    points += SCORING.correctResult;
  }

  if (predictedTeam1 === actualTeam1) points += SCORING.correctTeam1Score;
  if (predictedTeam2 === actualTeam2) points += SCORING.correctTeam2Score;

  const predictedDiff = predictedTeam1 - predictedTeam2;
  const actualDiff = actualTeam1 - actualTeam2;
  if (Math.abs(predictedDiff) === Math.abs(actualDiff)) points += SCORING.correctGoalDifference;

  return points;
};

export const processMatchResults = async (matchId: string) => {
  const match = await findMatchById(matchId);
  if (!match || match.status !== 'completed') {
    throw new Error('Match not found or not completed');
  }
  if (match.team1Score === null || match.team1Score === undefined || match.team2Score === null || match.team2Score === undefined) {
    throw new Error('Match scores not set');
  }

  const knockout = isKnockoutMatch(match);
  const users = await findUsersWithPredictionForMatch(matchId);

  for (const user of users) {
    const prediction = user.predictions.find((p) => p.matchId === matchId);
    if (!prediction) continue;

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
      match.penaltyWinner &&
      prediction.penaltyWinner &&
      prediction.penaltyWinner === match.penaltyWinner
    ) {
      points += SCORING.correctPenaltyWinner;
    }

    await updatePredictionPointsForMatch(user._id.toString(), matchId, points);
  }

  await applySnapshotsAfterMatchFinalized(matchId);
};

export const finalizeMatchScores = async (
  matchId: string,
  team1Score: number,
  team2Score: number,
  penaltyWinner?: string | null
) => {
  const winner = penaltyWinner ? String(penaltyWinner).trim() : '';
  const updated = await updateMatchById(matchId, {
    team1Score,
    team2Score,
    penaltyWinner: winner || null,
    status: 'completed',
  });
  if (!updated) throw new Error('Match not found');
  await processMatchResults(matchId);
  return updated;
};
