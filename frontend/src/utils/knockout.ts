import type { Match } from '../types';

/** Knockout fixtures have a non–group-stage round and no group letter. */
export function isKnockoutMatch(match: Pick<Match, 'round' | 'group'>): boolean {
  const round = String(match.round ?? '').trim().toLowerCase();
  if (!round || round === 'group stage') return false;
  if (match.group?.trim()) return false;
  return true;
}

export function needsPenaltyWinner(
  match: Pick<Match, 'round' | 'group'>,
  team1Score: number,
  team2Score: number
): boolean {
  return isKnockoutMatch(match) && team1Score === team2Score;
}
