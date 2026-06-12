import type { Collection, Db } from 'mongodb';
import {
  allGroupsComplete,
  computeGroupStandings,
  getTeamAtGroupPosition,
  type GroupStanding,
} from './groupStandings.js';
import { assignThirdPlaceToSlots } from './thirdPlaceBracket.js';
import {
  isNationTeamId,
  isPlaceholderTeamId,
  parseGroupPositionSlot,
  parseThirdPlaceSlot,
  parseWinnerSlot,
} from './placeholders.js';

interface TeamDocument {
  teamId: string;
  teamName: string;
  countryLogo?: string | null;
}

export interface KnockoutMatchDocument {
  _id: { toString(): string };
  sequence: number;
  team1: string;
  team2: string;
  team1Info?: { teamName: string; countryLogo?: string | null } | null;
  team2Info?: { teamName: string; countryLogo?: string | null } | null;
  team1Score?: number | null;
  team2Score?: number | null;
  matchTag: string;
  status: string;
}

export interface ResolvedMatchUpdate {
  matchId: string;
  matchTag: string;
  team1: string;
  team2: string;
  team1From?: string;
  team2From?: string;
}

async function resolveTeamInfo(
  teamsCol: Collection<TeamDocument>,
  teamId: string
): Promise<{ teamName: string; countryLogo?: string | null }> {
  const doc = await teamsCol.findOne({ teamId });
  if (doc) return { teamName: doc.teamName, countryLogo: doc.countryLogo ?? null };
  return { teamName: teamId };
}

function resolveSlotTeamId(
  placeholder: string,
  standings: GroupStanding[],
  thirdPlaceBySlot: Map<string, string>,
  matchBySequence: Map<number, KnockoutMatchDocument>
): string | null {
  if (isNationTeamId(placeholder)) return placeholder;

  const groupPos = parseGroupPositionSlot(placeholder);
  if (groupPos) {
    return getTeamAtGroupPosition(standings, groupPos.position, groupPos.group);
  }

  const thirdGroups = parseThirdPlaceSlot(placeholder);
  if (thirdGroups) {
    const slotId = `3${thirdGroups}`;
    return thirdPlaceBySlot.get(slotId) ?? null;
  }

  const winnerSeq = parseWinnerSlot(placeholder);
  if (winnerSeq != null) {
    const feeder = matchBySequence.get(winnerSeq);
    if (!feeder || feeder.status !== 'completed') return null;
    if (feeder.team1Score == null || feeder.team2Score == null) return null;
    if (!isNationTeamId(feeder.team1) || !isNationTeamId(feeder.team2)) return null;

    if (feeder.team1Score > feeder.team2Score) return feeder.team1;
    if (feeder.team2Score > feeder.team1Score) return feeder.team2;
    return null;
  }

  return null;
}

export async function resolveKnockoutTeams(
  db: Db,
  matchesCol: Collection<KnockoutMatchDocument>,
  teamsCol: Collection<TeamDocument>
): Promise<ResolvedMatchUpdate[]> {
  const allMatches = await matchesCol.find({}).sort({ sequence: 1 }).toArray();
  const matchBySequence = new Map(allMatches.map((m) => [m.sequence, m]));

  const standings = await computeGroupStandings(
    matchesCol as Collection<{
      group?: string | null;
      team1: string;
      team2: string;
      team1Score?: number | null;
      team2Score?: number | null;
      status: string;
    }>
  );

  const groupsDone = allGroupsComplete(standings);
  const thirdPlaceBySlot = groupsDone ? assignThirdPlaceToSlots(standings) : new Map<string, string>();

  const resolved: ResolvedMatchUpdate[] = [];
  const maxPasses = 20;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changedThisPass = false;

    for (const match of allMatches) {
      const needsTeam1 = isPlaceholderTeamId(match.team1);
      const needsTeam2 = isPlaceholderTeamId(match.team2);
      if (!needsTeam1 && !needsTeam2) continue;

      const nextTeam1 = needsTeam1
        ? resolveSlotTeamId(match.team1, standings, thirdPlaceBySlot, matchBySequence)
        : match.team1;
      const nextTeam2 = needsTeam2
        ? resolveSlotTeamId(match.team2, standings, thirdPlaceBySlot, matchBySequence)
        : match.team2;

      if (!nextTeam1 || !nextTeam2) continue;
      if (nextTeam1 === match.team1 && nextTeam2 === match.team2) continue;

      const [team1Info, team2Info] = await Promise.all([
        resolveTeamInfo(teamsCol, nextTeam1),
        resolveTeamInfo(teamsCol, nextTeam2),
      ]);

      await matchesCol.updateOne(
        { _id: match._id as never },
        {
          $set: {
            team1: nextTeam1,
            team2: nextTeam2,
            team1Info,
            team2Info,
            updatedAt: new Date(),
          },
        }
      );

      const update: ResolvedMatchUpdate = {
        matchId: match._id.toString(),
        matchTag: match.matchTag,
        team1: nextTeam1,
        team2: nextTeam2,
      };
      if (needsTeam1 && match.team1 !== nextTeam1) update.team1From = match.team1;
      if (needsTeam2 && match.team2 !== nextTeam2) update.team2From = match.team2;

      resolved.push(update);
      changedThisPass = true;

      match.team1 = nextTeam1;
      match.team2 = nextTeam2;
      match.team1Info = team1Info;
      match.team2Info = team2Info;
      matchBySequence.set(match.sequence, match);
    }

    if (!changedThisPass) break;
  }

  return resolved;
}
