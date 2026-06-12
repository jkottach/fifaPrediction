export function isNationTeamId(teamId: string): boolean {
  return /^[A-Z]{3}$/.test(teamId) && !/^[0-9W]/.test(teamId);
}

export function isPlaceholderTeamId(teamId: string): boolean {
  return !isNationTeamId(teamId);
}

export function formatResolvedKnockoutMessage(
  resolved: Array<{ matchTag: string; team1: string; team2: string }>
): string {
  if (resolved.length === 0) return '';
  const lines = resolved.slice(0, 3).map((r) => `${r.matchTag} → ${r.team1} vs ${r.team2}`);
  const extra = resolved.length > 3 ? ` (+${resolved.length - 3} more)` : '';
  return `Knockout updated: ${lines.join('; ')}${extra}`;
}
