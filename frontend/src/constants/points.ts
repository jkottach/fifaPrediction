/** Match score prediction — mirrors api/src/services/scoringService.ts */
export const MATCH_POINTS = {
  correctResult: 5,
  correctTeam1Score: 2,
  correctTeam2Score: 2,
  correctGoalDifference: 1,
  maxPerMatch: 10,
} as const;

/** Tournament picks (group + knockout) — applied when official results are entered */
export const TOURNAMENT_POINTS = {
  groupChampion: 3,
  semifinalist: 5,
  finalist: 8,
  champion: 15,
} as const;

export const TOURNAMENT_GROUP_COUNT = 12;

export function maxTournamentPoints(): number {
  return (
    TOURNAMENT_GROUP_COUNT * TOURNAMENT_POINTS.groupChampion +
    4 * TOURNAMENT_POINTS.semifinalist +
    2 * TOURNAMENT_POINTS.finalist +
    TOURNAMENT_POINTS.champion
  );
}
