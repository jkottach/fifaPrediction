import type { GroupStanding, RankedTeam } from './groupStandings.js';

/**
 * FIFA 2026 Round of 32 third-place slots from seeded bracket.
 * Each key is the full placeholder id (e.g. 3ABCDF); value is eligible groups in FIFA priority order.
 */
export const THIRD_PLACE_SLOT_GROUPS: Record<string, string[]> = {
  '3ABCDF': ['A', 'B', 'C', 'D', 'F'],
  '3CDFGH': ['C', 'D', 'F', 'G', 'H'],
  '3CEFHI': ['C', 'E', 'F', 'H', 'I'],
  '3EHIJK': ['E', 'H', 'I', 'J', 'K'],
  '3BEFIJ': ['B', 'E', 'F', 'I', 'J'],
  '3AEHIJ': ['A', 'E', 'H', 'I', 'J'],
  '3EFGIJ': ['E', 'F', 'G', 'I', 'J'],
  '3DEIJL': ['D', 'E', 'I', 'J', 'L'],
};

export interface ThirdPlaceCandidate {
  group: string;
  teamId: string;
  rankAmongThirds: number;
  stats: RankedTeam;
}

function compareThirdPlace(a: RankedTeam, b: RankedTeam): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.teamId.localeCompare(b.teamId);
}

/** Top 8 third-place teams across all completed groups. */
export function rankThirdPlaceTeams(standings: GroupStanding[]): ThirdPlaceCandidate[] {
  const thirds: ThirdPlaceCandidate[] = [];

  for (const standing of standings) {
    if (!standing.complete || standing.ranked.length < 3) continue;
    const third = standing.ranked[2];
    thirds.push({
      group: standing.group,
      teamId: third.teamId,
      rankAmongThirds: 0,
      stats: third,
    });
  }

  thirds.sort((a, b) => compareThirdPlace(a.stats, b.stats));
  return thirds.map((row, index) => ({ ...row, rankAmongThirds: index + 1 }));
}

export function getQualifyingThirdPlaceTeams(
  standings: GroupStanding[]
): Map<string, string> {
  const ranked = rankThirdPlaceTeams(standings);
  const top8 = ranked.slice(0, 8);
  return new Map(top8.map((t) => [t.group, t.teamId]));
}

/** Assign each 3XXX slot to one qualifying third-place team (no duplicate groups). */
export function assignThirdPlaceToSlots(standings: GroupStanding[]): Map<string, string> {
  const ranked = rankThirdPlaceTeams(standings);
  const top8 = ranked.slice(0, 8);
  const assignedGroups = new Set<string>();
  const result = new Map<string, string>();

  for (const [slotId, eligible] of Object.entries(THIRD_PLACE_SLOT_GROUPS)) {
    for (const group of eligible) {
      const candidate = top8.find((t) => t.group === group && !assignedGroups.has(group));
      if (candidate) {
        result.set(slotId, candidate.teamId);
        assignedGroups.add(group);
        break;
      }
    }
  }

  return result;
}

export function resolveThirdPlaceSlot(
  slotId: string,
  standings: GroupStanding[]
): string | null {
  return assignThirdPlaceToSlots(standings).get(slotId) ?? null;
}
