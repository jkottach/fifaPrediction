/**
 * Match scoring — kept in sync with Kanhans_Fifa26/api/src/services/scoringService.ts
 */
import {
  isKnockoutRoundForScoring,
  normalizeTeamId,
  resolveCanonicalTeamId,
  teamIdsEqual,
  usesAdvancerKnockoutScoring,
} from './knockout.js';

const SCORING = {
  correctResult: 5,
  correctTeam1Score: 2,
  correctTeam2Score: 2,
  correctGoalDifference: 1,
  correctPenaltyWinner: 2,
} as const;

export const SCORING_VERSION = 'round-aware-v4';

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

function groupStageOutcome(team1Score: number, team2Score: number): 1 | -1 | 0 {
  if (team1Score > team2Score) return 1;
  if (team1Score < team2Score) return -1;
  return 0;
}

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

export function calculatePredictionPoints(
  predictedTeam1: number,
  predictedTeam2: number,
  actualTeam1: number,
  actualTeam2: number,
  opts?: {
    isKnockout?: boolean;
    useAdvancerScoring?: boolean;
    actualPenaltyWinner?: string | null;
    predictedPenaltyWinner?: string | null;
    team1?: string;
    team2?: string;
  }
): number {
  let points = 0;

  if (opts?.isKnockout && opts.team1 && opts.team2) {
    if (opts.useAdvancerScoring) {
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
      const predictedOutcome = getFinalOutcome(predictedTeam1, predictedTeam2, {
        isKnockout: true,
        penaltyWinner: opts.predictedPenaltyWinner,
        team1: opts.team1,
        team2: opts.team2,
      });
      const actualOutcome = getFinalOutcome(actualTeam1, actualTeam2, {
        isKnockout: true,
        penaltyWinner: opts.actualPenaltyWinner,
        team1: opts.team1,
        team2: opts.team2,
      });
      if (predictedOutcome === actualOutcome) {
        points += SCORING.correctResult;
      }
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
}

export function scorePredictionForMatch(
  match: {
    round?: string;
    group?: string | null;
    sequence?: number;
    team1: string;
    team2: string;
    team1Score: number;
    team2Score: number;
    penaltyWinner?: string | null;
  },
  prediction: {
    team1Score: number;
    team2Score: number;
    penaltyWinner?: string | null;
  }
): number {
  const useAdvancerScoring = usesAdvancerKnockoutScoring(match);
  const knockout = isKnockoutRoundForScoring(match);

  let points = calculatePredictionPoints(
    prediction.team1Score,
    prediction.team2Score,
    match.team1Score,
    match.team2Score,
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

  return points;
}
