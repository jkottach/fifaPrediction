export const GOAL_SCORE_MAX = 20;

export type GoalScoreInput = number | '';

/** Allow only whole numbers 0–20 while typing; empty string is allowed. */
export function parseGoalScoreInput(raw: string): GoalScoreInput {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return '';
  const value = Math.min(GOAL_SCORE_MAX, parseInt(digits, 10));
  return Number.isNaN(value) ? '' : value;
}

export function isValidGoalScore(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= GOAL_SCORE_MAX
  );
}

/** Coerce legacy decimal scores (e.g. 0.1) to the nearest whole number when loading. */
export function normalizeGoalScore(value: unknown): GoalScoreInput {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > GOAL_SCORE_MAX) return '';
  return rounded;
}
