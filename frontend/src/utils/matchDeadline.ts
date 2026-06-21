interface MatchTimes {
  predictionsEndingTime?: string | null;
  matchTime?: string | null;
}

/** Parse API ISO deadline; fall back to one hour before kickoff. */
export function getPredictionDeadlineMs(match: MatchTimes): number | null {
  if (match.predictionsEndingTime) {
    const ms = Date.parse(match.predictionsEndingTime);
    if (!Number.isNaN(ms)) return ms;
  }

  if (match.matchTime) {
    const kickoff = Date.parse(match.matchTime);
    if (!Number.isNaN(kickoff)) return kickoff - 60 * 60 * 1000;
  }

  return null;
}

export function getPredictionDeadlineIso(match: MatchTimes): string | null {
  const ms = getPredictionDeadlineMs(match);
  return ms === null ? null : new Date(ms).toISOString();
}

export function isMatchOpenForPrediction(match: MatchTimes, now = Date.now()): boolean {
  const deadline = getPredictionDeadlineMs(match);
  if (deadline === null) return true;
  return deadline > now;
}

export function isBeforeKickoff(match: MatchTimes, now = Date.now()): boolean {
  const kickoff = Date.parse(match.matchTime ?? '');
  return !Number.isNaN(kickoff) && kickoff > now;
}

/** Predictions closed but kickoff has not started — show locked pick on dashboard. */
export function isLockedAwaitingKickoff(match: MatchTimes, now = Date.now()): boolean {
  return isBeforeKickoff(match, now) && !isMatchOpenForPrediction(match, now);
}
