export const GOAL_SCORE_MAX = 20;

export function normalizeGoalScore(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Goal scores must be numbers');
  }
  const rounded = Math.round(value);
  if (!Number.isInteger(rounded) || rounded < 0 || rounded > GOAL_SCORE_MAX) {
    throw new Error(`Goal scores must be whole numbers between 0 and ${GOAL_SCORE_MAX}`);
  }
  return rounded;
}

export function tryNormalizeGoalScore(value: unknown): number | null {
  try {
    return normalizeGoalScore(value);
  } catch {
    return null;
  }
}

export function isIntegerGoalScore(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= GOAL_SCORE_MAX
  );
}
