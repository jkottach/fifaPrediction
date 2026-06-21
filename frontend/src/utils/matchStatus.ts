interface MatchStatusFields {
  status?: string | null;
  matchTime?: string | null;
}

export function normalizeMatchStatus(status?: string | null): string {
  return String(status || '').trim().toLowerCase();
}

export function isMatchCompleted(match: MatchStatusFields): boolean {
  return normalizeMatchStatus(match.status) === 'completed';
}

/** Live if explicitly ongoing, or kickoff has passed and the match is not completed. */
export function isMatchLive(match: MatchStatusFields, now = Date.now()): boolean {
  if (isMatchCompleted(match)) return false;

  const status = normalizeMatchStatus(match.status);
  if (status === 'ongoing') return true;

  const kickoff = Date.parse(match.matchTime ?? '');
  if (Number.isNaN(kickoff)) return false;

  return kickoff <= now;
}
