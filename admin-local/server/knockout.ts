/** Normalize nation / placeholder team IDs for reliable comparisons. */
export function normalizeTeamId(teamId: string): string {
  return teamId.trim().toUpperCase();
}

export function teamIdsEqual(a: string, b: string): boolean {
  return normalizeTeamId(a) === normalizeTeamId(b);
}

/** Match a pick to team1 or team2 (case-insensitive) and return the canonical stored id. */
export function resolveCanonicalTeamId(
  pick: string,
  team1: string,
  team2: string
): string | null {
  const normalized = normalizeTeamId(pick);
  if (normalizeTeamId(team1) === normalized) return team1.trim();
  if (normalizeTeamId(team2) === normalized) return team2.trim();
  return null;
}

/** Knockout fixtures have a non–group-stage round and no group letter. */
export function isKnockoutMatch(match: { round?: string; group?: string | null }): boolean {
  const round = String(match.round ?? '').trim().toLowerCase();
  if (!round || round === 'group stage') return false;
  if (match.group?.trim()) return false;
  return true;
}

/** Round of 32 uses legacy outcome-based knockout scoring (M73–M88). */
export function isRoundOf32Match(match: { round?: string; sequence?: number }): boolean {
  const round = String(match.round ?? '').trim().toLowerCase();
  if (round === 'round of 32') return true;
  const seq = match.sequence;
  return seq != null && seq >= 73 && seq <= 88;
}

const ADVANCER_SCORING_ROUNDS = new Set([
  'round of 16',
  'quarter finals',
  'semi finals',
  '3rd place',
  'final',
]);

export function usesAdvancerKnockoutScoring(match: { round?: string; sequence?: number }): boolean {
  const round = String(match.round ?? '').trim().toLowerCase();
  if (ADVANCER_SCORING_ROUNDS.has(round)) return true;
  if (
    round.includes('round of 16') ||
    round.includes('quarter') ||
    round.includes('semi') ||
    round === 'final' ||
    round.includes('3rd')
  ) {
    return true;
  }
  const seq = match.sequence;
  return seq != null && seq >= 89;
}

/** Any knockout round (R32 through Final) — uses sequence fallback when round metadata is missing. */
export function isKnockoutRoundForScoring(match: {
  round?: string;
  group?: string | null;
  sequence?: number;
}): boolean {
  if (isKnockoutMatch(match)) return true;
  if (isRoundOf32Match(match)) return true;
  if (usesAdvancerKnockoutScoring(match)) return true;
  const seq = match.sequence;
  return seq != null && seq >= 73;
}
