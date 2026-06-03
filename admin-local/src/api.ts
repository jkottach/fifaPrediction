import axios from 'axios';
import type {
  GroupStageGroupInfo,
  Match,
  Tenant,
  TournamentOfficialResults,
} from './types';
import { TENANT_STORAGE_KEY } from './types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

let activeTenantId = '';

export function getActiveTenantId(): string {
  return activeTenantId;
}

export function setActiveTenantId(tenantId: string): void {
  activeTenantId = tenantId;
  if (tenantId) {
    localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
    client.defaults.headers.common['X-Tenant-Id'] = tenantId;
  } else {
    localStorage.removeItem(TENANT_STORAGE_KEY);
    delete client.defaults.headers.common['X-Tenant-Id'];
  }
}

export function restoreTenantFromStorage(): string | null {
  return localStorage.getItem(TENANT_STORAGE_KEY);
}

export async function getTenants(): Promise<{
  tenants: Tenant[];
  defaultTenantId: string;
  allTenantId: string;
  supportsAllTenants: boolean;
}> {
  const res = await axios.get('/api/tenants');
  return res.data;
}

export async function getAllMatches(status?: string, page = 1, limit = 100) {
  const res = await client.get('/matches', { params: { status, page, limit } });
  return res.data as {
    matches: Match[];
    pagination: { total: number; page: number; limit: number; pages: number };
    tenant?: Tenant;
  };
}

export async function finalizeMatch(
  matchId: string,
  team1Score: number,
  team2Score: number,
  matchTag?: string
) {
  const res = await client.post('/local-admin/finalize-match', {
    matchId,
    team1Score,
    team2Score,
    matchTag,
  });
  return res.data as {
    message: string;
    match: Match;
    tenant?: Tenant;
    outcomes?: Array<{
      tenant: Tenant;
      ok: boolean;
      error?: string;
    }>;
  };
}

export async function getTournamentSetup() {
  const res = await client.get('/tournament/setup');
  return res.data as {
    groups: GroupStageGroupInfo[];
    results: TournamentOfficialResults | null;
    points: typeof import('./constants/tournamentPoints').TOURNAMENT_POINTS;
    predictionsCount: number;
    tenant?: Tenant;
    previewTenantId?: string;
  };
}

export async function applyTournamentResults(body: TournamentOfficialResults) {
  const res = await client.post('/local-admin/tournament-results', body);
  return res.data as {
    message: string;
    usersUpdated?: number;
    tenant?: Tenant;
    outcomes?: Array<{
      tenant: Tenant;
      ok: boolean;
      usersUpdated?: number;
      error?: string;
    }>;
  };
}

export async function getTopLeaderboard(limit = 10) {
  const res = await client.get('/leaderboard/top', { params: { limit } });
  return res.data as {
    leaderboard: Array<{ rank: number; name: string; totalPoints: number; email: string }>;
    tenant?: Tenant;
  };
}
