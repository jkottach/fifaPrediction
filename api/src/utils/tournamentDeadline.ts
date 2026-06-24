import { TOURNAMENT_PREDICTION_DEADLINE_DEFAULT } from '../constants/tournamentDeadline';

export function resolvePredictionDeadline(): Date {
  const env = process.env.TOURNAMENT_PREDICTION_DEADLINE?.trim();
  if (env) {
    const parsed = new Date(env);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(TOURNAMENT_PREDICTION_DEADLINE_DEFAULT);
}

export function isTournamentPredictionDeadlinePassed(now = new Date()): boolean {
  return now.getTime() >= resolvePredictionDeadline().getTime();
}
