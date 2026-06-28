/** Knockout fixtures have a non–group-stage round and no group letter. */
export function isKnockoutMatch(match: { round?: string; group?: string | null }): boolean {
  const round = String(match.round ?? '').trim().toLowerCase();
  if (!round || round === 'group stage') return false;
  if (match.group?.trim()) return false;
  return true;
}

/** FIFA nation codes (excludes knockout placeholders like 1A, W73, 3EFGIJ). */
export function isNationTeamId(teamId: string): boolean {
  return /^[A-Z]{3}$/.test(teamId) && !/^[0-9WL]/.test(teamId);
}

/** Human-readable label for bracket placeholder team IDs; null for real nations. */
export function formatBracketPlaceholderLabel(teamId: string): string | null {
  const id = teamId.trim();
  if (!id || isNationTeamId(id)) return null;

  const groupPlace = id.match(/^([12])([A-L])$/);
  if (groupPlace) {
    const place = groupPlace[1] === '1' ? '1st' : '2nd';
    return `${place} in Group ${groupPlace[2]}`;
  }

  const thirdPlace = id.match(/^3([A-L]+)$/);
  if (thirdPlace) {
    const groups = thirdPlace[1].split('').join(' / ');
    return `3rd place (${groups})`;
  }

  const winner = id.match(/^W(\d+)$/);
  if (winner) return `Winner of M${winner[1]}`;

  const loser = id.match(/^(?:L|RU)(\d+)$/);
  if (loser) return `Loser of M${loser[1]}`;

  return `TBD (${id})`;
}

/** Short initials for placeholder avatars (max ~3 chars). */
export function bracketPlaceholderInitials(teamId: string): string {
  const label = formatBracketPlaceholderLabel(teamId);
  if (!label) return teamId.slice(0, 3);
  if (/^3rd place/.test(label)) return '3rd';
  if (/^1st in Group/.test(label)) return '1st';
  if (/^2nd in Group/.test(label)) return '2nd';
  if (/^Winner of M/.test(label)) return 'W';
  if (/^Loser of M/.test(label)) return 'L';
  return 'TBD';
}
