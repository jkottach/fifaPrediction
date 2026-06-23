export interface TeamInfo {
  teamName: string;
  countryLogo?: string | null;
}

export interface Match {
  matchId: string;
  team1: string;
  team2: string;
  team1Score?: number | null;
  team2Score?: number | null;
  penaltyWinner?: string | null;
  matchTime: string;
  predictionsEndingTime: string;
  round: string;
  group?: string;
  matchTag: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  team1Info?: TeamInfo | null;
  team2Info?: TeamInfo | null;
}

export type MatchStatusFilter = 'all' | 'scheduled' | 'ongoing' | 'completed';

export interface Tenant {
  id: string;
  label: string;
  dbName: string;
  url?: string | null;
}

export const TENANT_STORAGE_KEY = 'admin-local-tenant-id';
export const AUTH_STORAGE_KEY = 'admin-local-auth-token';

export interface TournamentTeamOption {
  teamId: string;
  teamName: string;
  countryLogo?: string | null;
}

export interface GroupStageGroupInfo {
  group: string;
  teams: TournamentTeamOption[];
}

export interface TournamentOfficialResults {
  champion: string;
  finalists: [string, string];
  semifinalists: [string, string, string, string];
  groupChampions: Record<string, string>;
}

/** Virtual selection: apply scoring to every configured database. */
export const ALL_TENANT_ID = 'all';

export interface RankedTeamStanding {
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

export interface GroupStandingRow {
  group: string;
  complete: boolean;
  ranked: RankedTeamStanding[];
}

export interface ResolvedKnockoutMatch {
  matchId: string;
  matchTag: string;
  team1: string;
  team2: string;
  team1From?: string;
  team2From?: string;
}
