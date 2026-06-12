import type { Collection } from 'mongodb';
import { isNationTeamId } from './placeholders.js';

export interface GroupMatchRow {
  group: string;
  team1: string;
  team2: string;
  team1Score: number;
  team2Score: number;
  status: string;
}

export interface RankedTeam {
  teamId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface GroupStanding {
  group: string;
  complete: boolean;
  ranked: RankedTeam[];
}

interface TeamStats {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

function emptyStats(teamId: string): TeamStats {
  return { teamId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
}

function applyResult(stats: TeamStats, goalsFor: number, goalsAgainst: number): void {
  stats.played += 1;
  stats.goalsFor += goalsFor;
  stats.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) stats.won += 1;
  else if (goalsFor < goalsAgainst) stats.lost += 1;
  else stats.drawn += 1;
}

function toRanked(stats: TeamStats): RankedTeam {
  const points = stats.won * 3 + stats.drawn;
  return {
    teamId: stats.teamId,
    position: 0,
    played: stats.played,
    won: stats.won,
    drawn: stats.drawn,
    lost: stats.lost,
    goalsFor: stats.goalsFor,
    goalsAgainst: stats.goalsAgainst,
    goalDifference: stats.goalsFor - stats.goalsAgainst,
    points,
  };
}

function headToHeadPoints(
  teamIds: string[],
  groupMatches: GroupMatchRow[]
): Map<string, number> {
  const points = new Map<string, number>();
  for (const id of teamIds) points.set(id, 0);

  for (const m of groupMatches) {
    if (!teamIds.includes(m.team1) || !teamIds.includes(m.team2)) continue;
    if (m.team1Score > m.team2Score) points.set(m.team1, (points.get(m.team1) ?? 0) + 3);
    else if (m.team2Score > m.team1Score) points.set(m.team2, (points.get(m.team2) ?? 0) + 3);
    else {
      points.set(m.team1, (points.get(m.team1) ?? 0) + 1);
      points.set(m.team2, (points.get(m.team2) ?? 0) + 1);
    }
  }
  return points;
}

function headToHeadGoalDifference(
  teamIds: string[],
  groupMatches: GroupMatchRow[]
): Map<string, number> {
  const gd = new Map<string, number>();
  for (const id of teamIds) gd.set(id, 0);

  for (const m of groupMatches) {
    if (!teamIds.includes(m.team1) || !teamIds.includes(m.team2)) continue;
    gd.set(m.team1, (gd.get(m.team1) ?? 0) + (m.team1Score - m.team2Score));
    gd.set(m.team2, (gd.get(m.team2) ?? 0) + (m.team2Score - m.team1Score));
  }
  return gd;
}

function compareRanked(a: RankedTeam, b: RankedTeam): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.teamId.localeCompare(b.teamId);
}

function rankTeamsInGroup(
  teamIds: string[],
  groupMatches: GroupMatchRow[]
): RankedTeam[] {
  const statsMap = new Map<string, TeamStats>();
  for (const id of teamIds) statsMap.set(id, emptyStats(id));

  for (const m of groupMatches) {
    if (!teamIds.includes(m.team1) || !teamIds.includes(m.team2)) continue;
    applyResult(statsMap.get(m.team1)!, m.team1Score, m.team2Score);
    applyResult(statsMap.get(m.team2)!, m.team2Score, m.team1Score);
  }

  let ranked = [...statsMap.values()].map(toRanked);

  const tieGroups = new Map<number, RankedTeam[]>();
  for (const row of ranked) {
    const key = row.points * 10000 + row.goalDifference;
    if (!tieGroups.has(key)) tieGroups.set(key, []);
    tieGroups.get(key)!.push(row);
  }

  for (const tied of tieGroups.values()) {
    if (tied.length < 2) continue;
    const ids = tied.map((t) => t.teamId);
    const h2hPts = headToHeadPoints(ids, groupMatches);
    const h2hGd = headToHeadGoalDifference(ids, groupMatches);

    tied.sort((a, b) => {
      const ptDiff = (h2hPts.get(b.teamId) ?? 0) - (h2hPts.get(a.teamId) ?? 0);
      if (ptDiff !== 0) return ptDiff;
      const gdDiff = (h2hGd.get(b.teamId) ?? 0) - (h2hGd.get(a.teamId) ?? 0);
      if (gdDiff !== 0) return gdDiff;
      return compareRanked(a, b);
    });
  }

  ranked.sort(compareRanked);

  // Re-apply head-to-head ordering for tied clusters
  ranked = [...ranked].sort((a, b) => {
    if (a.points !== b.points || a.goalDifference !== b.goalDifference || a.goalsFor !== b.goalsFor) {
      return compareRanked(a, b);
    }
    const cluster = ranked.filter(
      (t) =>
        t.points === a.points &&
        t.goalDifference === a.goalDifference &&
        t.goalsFor === a.goalsFor
    );
    if (cluster.length < 2) return compareRanked(a, b);
    const ids = cluster.map((t) => t.teamId);
    const h2hPts = headToHeadPoints(ids, groupMatches);
    const h2hGd = headToHeadGoalDifference(ids, groupMatches);
    const ptDiff = (h2hPts.get(b.teamId) ?? 0) - (h2hPts.get(a.teamId) ?? 0);
    if (ptDiff !== 0) return ptDiff;
    const gdDiff = (h2hGd.get(b.teamId) ?? 0) - (h2hGd.get(a.teamId) ?? 0);
    if (gdDiff !== 0) return gdDiff;
    return a.teamId.localeCompare(b.teamId);
  });

  return ranked.map((row, index) => ({ ...row, position: index + 1 }));
}

export interface GroupFixtureRow {
  group: string;
  team1: string;
  team2: string;
  team1Score?: number | null;
  team2Score?: number | null;
  status: string;
}

export function computeGroupStandingsFromFixtures(fixtures: GroupFixtureRow[]): GroupStanding[] {
  const byGroup = new Map<string, { teams: Set<string>; completed: GroupMatchRow[] }>();

  for (const fixture of fixtures) {
    const group = fixture.group.trim().toUpperCase();
    if (!group) continue;

    if (!byGroup.has(group)) byGroup.set(group, { teams: new Set(), completed: [] });
    const bucket = byGroup.get(group)!;

    if (isNationTeamId(fixture.team1)) bucket.teams.add(fixture.team1);
    if (isNationTeamId(fixture.team2)) bucket.teams.add(fixture.team2);

    if (
      fixture.status === 'completed' &&
      fixture.team1Score != null &&
      fixture.team2Score != null
    ) {
      bucket.completed.push({
        group,
        team1: fixture.team1,
        team2: fixture.team2,
        team1Score: fixture.team1Score,
        team2Score: fixture.team2Score,
        status: fixture.status,
      });
    }
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, { teams, completed }]) => {
      const expectedMatches = (teams.size * (teams.size - 1)) / 2;
      const complete = teams.size === 4 && completed.length >= expectedMatches;
      const ranked =
        completed.length > 0 ? rankTeamsInGroup([...teams], completed) : [];

      return { group, complete, ranked };
    });
}

/** @deprecated Use computeGroupStandingsFromFixtures */
export function computeGroupStandingsFromMatches(rows: GroupMatchRow[]): GroupStanding[] {
  return computeGroupStandingsFromFixtures(
    rows.map((row) => ({
      group: row.group,
      team1: row.team1,
      team2: row.team2,
      team1Score: row.team1Score,
      team2Score: row.team2Score,
      status: row.status,
    }))
  );
}

export interface MatchDocForStandings {
  group?: string | null;
  team1: string;
  team2: string;
  team1Score?: number | null;
  team2Score?: number | null;
  status: string;
}

export async function computeGroupStandings(
  matchesCol: Collection<MatchDocForStandings>
): Promise<GroupStanding[]> {
  const raw = await matchesCol
    .find({ group: { $exists: true, $nin: [null, ''] } })
    .project({ group: 1, team1: 1, team2: 1, team1Score: 1, team2Score: 1, status: 1 })
    .toArray();

  const fixtures: GroupFixtureRow[] = raw
    .filter((m) => m.group)
    .map((m) => ({
      group: m.group!.trim().toUpperCase(),
      team1: m.team1,
      team2: m.team2,
      team1Score: m.team1Score,
      team2Score: m.team2Score,
      status: m.status,
    }));

  return computeGroupStandingsFromFixtures(fixtures);
}

export function getTeamAtGroupPosition(
  standings: GroupStanding[],
  position: 1 | 2 | 3,
  group: string
): string | null {
  const standing = standings.find((s) => s.group === group);
  if (!standing?.complete) return null;
  const row = standing.ranked[position - 1];
  return row?.teamId ?? null;
}

export function allGroupsComplete(standings: GroupStanding[], expectedGroups = 12): boolean {
  if (standings.length < expectedGroups) return false;
  return standings.every((s) => s.complete && s.ranked.length >= 3);
}
