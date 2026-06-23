/** Knockout fixtures have a non–group-stage round and no group letter. */
export function isKnockoutMatch(match: { round?: string; group?: string | null }): boolean {
  const round = String(match.round ?? '').trim().toLowerCase();
  if (!round || round === 'group stage') return false;
  if (match.group?.trim()) return false;
  return true;
}
