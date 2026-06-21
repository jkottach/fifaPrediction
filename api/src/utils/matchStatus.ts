interface MatchStatusFields {
  status?: string | null;
  matchTime?: Date | string | null;
  predictionsEndingTime?: Date | string | null;
}

function toMs(value?: Date | string | null): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
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

  const kickoff = toMs(match.matchTime);
  if (kickoff === null) return false;

  return kickoff <= now;
}

/** Parse deadline; fall back to one hour before kickoff. */
export function getPredictionDeadlineMs(match: MatchStatusFields): number | null {
  const deadline = toMs(match.predictionsEndingTime);
  if (deadline !== null) return deadline;

  const kickoff = toMs(match.matchTime);
  if (kickoff !== null) return kickoff - 60 * 60 * 1000;

  return null;
}

export function isPredictionDeadlineClosed(match: MatchStatusFields, now = Date.now()): boolean {
  const deadline = getPredictionDeadlineMs(match);
  if (deadline === null) return false;
  return deadline <= now;
}

/** Community picks visible only when the match is live and the prediction window has closed. */
export function canRevealLivePredictions(match: MatchStatusFields, now = Date.now()): boolean {
  return isMatchLive(match, now) && isPredictionDeadlineClosed(match, now);
}
