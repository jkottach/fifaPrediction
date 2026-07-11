/** Mirrors frontend/src/constants/points.ts on the main app */
export const TOURNAMENT_POINTS = {
  groupChampion: 3,
  semifinalist: 5,
  finalist: 8,
  champion: 15,
} as const;

export type GroupChampionsPicks = Record<string, string>;

export interface TournamentBracketPrediction {
  champion: string;
  finalists: [string, string];
  semifinalists: [string, string, string, string];
  groupChampions?: GroupChampionsPicks;
  points?: number;
  submittedTime?: Date;
  updatedAt?: Date;
}

export interface TournamentOfficialResults {
  champion: string;
  finalists: [string, string];
  semifinalists: [string, string, string, string];
  groupChampions: GroupChampionsPicks;
}

export function calculateTournamentPredictionPoints(
  prediction: TournamentBracketPrediction,
  results: TournamentOfficialResults
): number {
  let points = 0;

  if (results.champion && prediction.champion === results.champion) {
    points += TOURNAMENT_POINTS.champion;
  }

  for (const teamId of results.finalists) {
    if (teamId && prediction.finalists.includes(teamId)) {
      points += TOURNAMENT_POINTS.finalist;
    }
  }

  for (const teamId of results.semifinalists) {
    if (teamId && prediction.semifinalists.includes(teamId)) {
      points += TOURNAMENT_POINTS.semifinalist;
    }
  }

  if (prediction.groupChampions && results.groupChampions) {
    for (const [group, actualTeamId] of Object.entries(results.groupChampions)) {
      const predicted = prediction.groupChampions[group];
      if (predicted && predicted === actualTeamId) {
        points += TOURNAMENT_POINTS.groupChampion;
      }
    }
  }

  return points;
}

export function normalizeGroupChampions(raw: GroupChampionsPicks): GroupChampionsPicks {
  const normalized: GroupChampionsPicks = {};
  for (const [group, teamId] of Object.entries(raw)) {
    const g = group.trim().toUpperCase();
    const id = teamId.trim().toUpperCase();
    if (g && id) normalized[g] = id;
  }
  return normalized;
}

export function validateBracketLogic(
  champion: string,
  finalists: [string, string],
  semifinalists: [string, string, string, string]
): string | null {
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  if (!unique(semifinalists)) return 'Each semifinalist must be a different team';
  if (!unique(finalists)) return 'Both finalists must be different teams';
  if (!finalists.includes(champion)) return 'Champion must be one of the two finalists';
  for (const f of finalists) {
    if (!semifinalists.includes(f)) {
      return 'Both finalists must be chosen from the four semifinalist picks';
    }
  }
  return null;
}

/**
 * Lenient version of validateBracketLogic for partial ("save as results come in")
 * brackets: only checks the slots that are actually filled, so an admin can save
 * one semifinalist without having picked finalists or a champion yet.
 */
export function validatePartialBracketLogic(
  champion: string,
  finalists: [string, string],
  semifinalists: [string, string, string, string]
): string | null {
  const filledSemis = semifinalists.filter(Boolean);
  const filledFinalists = finalists.filter(Boolean);

  if (new Set(filledSemis).size !== filledSemis.length) {
    return 'Each semifinalist must be a different team';
  }
  if (new Set(filledFinalists).size !== filledFinalists.length) {
    return 'Both finalists must be different teams';
  }
  // A finalist must be one of the semifinalists — only enforce once all four semis are set.
  if (filledSemis.length === 4) {
    for (const f of filledFinalists) {
      if (!semifinalists.includes(f)) {
        return 'Both finalists must be chosen from the four semifinalist picks';
      }
    }
  }
  // Champion must be one of the finalists — only enforce once both finalists are set.
  if (champion && filledFinalists.length === 2 && !finalists.includes(champion)) {
    return 'Champion must be one of the two finalists';
  }
  return null;
}
