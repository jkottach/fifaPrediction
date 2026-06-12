/** FIFA nation codes (excludes knockout placeholders like 1A, W73, 3ABCDF). */
export function isNationTeamId(teamId: string): boolean {
  return /^[A-Z]{3}$/.test(teamId) && !/^[0-9W]/.test(teamId);
}

export function isPlaceholderTeamId(teamId: string): boolean {
  return !isNationTeamId(teamId);
}

/** Group finish slot: 1A, 2B, etc. */
export function parseGroupPositionSlot(teamId: string): { position: 1 | 2; group: string } | null {
  const match = /^([12])([A-L])$/.exec(teamId);
  if (!match) return null;
  return { position: Number(match[1]) as 1 | 2, group: match[2] };
}

/** Third-place combination slot: 3ABCDF, etc. */
export function parseThirdPlaceSlot(teamId: string): string | null {
  const match = /^3([A-L]+)$/.exec(teamId);
  return match ? match[1] : null;
}

/** Winner of match by sequence: W73, W101, etc. */
export function parseWinnerSlot(teamId: string): number | null {
  const match = /^W(\d+)$/.exec(teamId);
  return match ? Number(match[1]) : null;
}
