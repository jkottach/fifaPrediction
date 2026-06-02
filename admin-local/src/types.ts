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
}

export const TENANT_STORAGE_KEY = 'admin-local-tenant-id';
