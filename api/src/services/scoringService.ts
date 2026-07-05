import {
  findMatchById,
  findUsersWithPredictionForMatch,
  updateMatchById,
  updatePredictionPointsForMatch,
  applySnapshotsAfterMatchFinalized,
} from '../db/repositories';
import { matchIdsEqual } from '../db/helpers';
import {
  isKnockoutMatch,
  normalizeTeamId,
  resolveCanonicalTeamId,
  teamIdsEqual,
} from '../utils/knockout';

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
  correctPenaltyWinner: 5,
};

/**
 * Resolves the team that wins/advances in a knockout match.
 * Full-time winner if not level; otherwise the penalty shootout winner.
 */
function resolveKnockoutWinner(
  team1Score: number,
  team2Score: number,
  team1: string,
  team2: string,
  penaltyWinner?: string | null
): string | null {
  const t1 = normalizeTeamId(team1);
  const t2 = normalizeTeamId(team2);
  if (team1Score > team2Score) return t1;
  if (team1Score < team2Score) return t2;
  if (!penaltyWinner?.trim()) return null;
  const canonical = resolveCanonicalTeamId(penaltyWinner, team1, team2);
  return canonical ? normalizeTeamId(canonical) : null;
}

/** Group-stage outcome: 1 (team1 win), -1 (team2 win), or 0 (draw). */
function groupStageOutcome(team1Score: number, team2Score: number): 1 | -1 | 0 {
  if (team1Score > team2Score) return 1;
  if (team1Score < team2Score) return -1;
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

  if (opts?.isKnockout && opts.team1 && opts.team2) {
    const predictedWinner = resolveKnockoutWinner(
      predictedTeam1,
      predictedTeam2,
      opts.team1,
      opts.team2,
      opts.predictedPenaltyWinner
    );
    const actualWinner = resolveKnockoutWinner(
      actualTeam1,
      actualTeam2,
      opts.team1,
      opts.team2,
      opts.actualPenaltyWinner
    );
    if (predictedWinner && actualWinner && predictedWinner === actualWinner) {
      points += SCORING.correctResult;
    }
  } else {
    const predictedOutcome = groupStageOutcome(predictedTeam1, predictedTeam2);
    const actualOutcome = groupStageOutcome(actualTeam1, actualTeam2);
    if (predictedOutcome === actualOutcome) {
      points += SCORING.correctResult;
    }
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

  const resolvedMatchId = match._id.toString();
  const users = await findUsersWithPredictionForMatch(resolvedMatchId);

  for (const user of users) {
    const prediction = user.predictions.find((p) => matchIdsEqual(p.matchId, resolvedMatchId));
    if (!prediction) continue;

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
      teamIdsEqual(prediction.penaltyWinner, match.penaltyWinner)
    ) {
      points += SCORING.correctPenaltyWinner;
    }

    await updatePredictionPointsForMatch(user._id.toString(), resolvedMatchId, points);
  }

  await applySnapshotsAfterMatchFinalized(resolvedMatchId);
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
