import { ObjectId } from 'mongodb';
import type { MatchDocument, TeamDocument, UserDocument } from './types';

/** FIFA nation codes (excludes knockout placeholders like 1A, W73). */
export function isPickableNationTeamId(teamId: string): boolean {
  return /^[A-Z]{3}$/.test(teamId) && !/^[0-9W]/.test(teamId);
}

export function formatUserId(user: UserDocument): string {
  return user._id.toString();
}

/** Dense ranking: 1, 2, 2, 3… tied scores share a rank. Input must be sorted by points desc. */
export function assignDenseRanks<T extends { totalPoints: number }>(
  items: T[]
): Array<T & { rank: number }> {
  let lastPoints = Number.NaN;
  let rank = 0;

  return items.map((item) => {
    const points = item.totalPoints ?? 0;
    if (points !== lastPoints) {
      rank++;
      lastPoints = points;
    }
    return { ...item, rank };
  });
}

/** Leaderboard and public rankings — honors both `isActive` and `status`. */
export function isUserLeaderboardEligible(
  user: Pick<UserDocument, 'isActive' | 'status'>
): boolean {
  if (user.isActive === false) return false;
  const status = (user.status ?? 'active').trim().toLowerCase();
  return status !== 'inactive' && status !== 'suspended';
}

export function formatMatchId(match: MatchDocument): string {
  return match._id.toString();
}

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object' && '$date' in (value as object)) {
    const raw = (value as { $date: string | number }).$date;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toIso(value: unknown): string | null {
  const d = toDate(value);
  return d ? d.toISOString() : null;
}

/** Explicit API shape — avoids BSON / spread issues in JSON responses. */
export function formatMatchForApi(match: MatchDocument) {
  return {
    matchId: match._id.toString(),
    _id: match._id.toString(),
    sequence: match.sequence ?? 0,
    team1: String(match.team1 ?? ''),
    team2: String(match.team2 ?? ''),
    team1Info: match.team1Info ?? null,
    team2Info: match.team2Info ?? null,
    team1Score: match.team1Score ?? null,
    team2Score: match.team2Score ?? null,
    matchTime: toIso(match.matchTime),
    predictionsEndingTime: toIso(match.predictionsEndingTime),
    round: match.round ?? '',
    group: match.group ?? null,
    comment: match.comment ?? null,
    matchTag: match.matchTag ?? '',
    status: match.status ?? 'scheduled',
    createdAt: toIso(match.createdAt),
    updatedAt: toIso(match.updatedAt),
  };
}

export function formatUserForAuth(user: UserDocument) {
  return {
    userId: formatUserId(user),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    city: user.city,
    state: user.state,
    country: user.country,
    phoneNumber: user.phoneNumber ?? undefined,
    profileImage: user.profileImage ?? undefined,
    role: user.role,
    status: user.status,
    isActive: user.isActive,
  };
}

export function formatUserProfile(user: UserDocument) {
  return {
    ...formatUserForAuth(user),
    createdAt: user.createdAt,
  };
}

export function teamMapFromDocs(teams: TeamDocument[]): Map<string, { teamName: string; countryLogo?: string | null }> {
  return new Map(teams.map((t) => [t.teamId, { teamName: t.teamName, countryLogo: t.countryLogo }]));
}

export function enrichMatchWithTeams(
  match: MatchDocument,
  teamById: Map<string, { teamName: string; countryLogo?: string | null }>
) {
  const base = formatMatchForApi(match);
  const t1 = String(match.team1 ?? '');
  const t2 = String(match.team2 ?? '');
  const info1 = teamById.get(t1);
  const info2 = teamById.get(t2);

  return {
    ...base,
    team1Info:
      match.team1Info ??
      (info1 ? { teamName: info1.teamName, countryLogo: info1.countryLogo ?? null } : null),
    team2Info:
      match.team2Info ??
      (info2 ? { teamName: info2.teamName, countryLogo: info2.countryLogo ?? null } : null),
  };
}

export function buildMatchTag(team1: string, team2: string): string {
  return `#${team1}_${team2}`;
}

export function sumPredictionPoints(predictions: { points?: number }[]): number {
  return predictions.reduce((sum, p) => sum + (p.points ?? 0), 0);
}

export function newObjectId(): ObjectId {
  return new ObjectId();
}
