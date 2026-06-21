import axios from 'axios';
import type {
  GroupStageGroupInfo,
  GroupStandingRow,
  Match,
  ResolvedKnockoutMatch,
  Tenant,
  TournamentOfficialResults,
} from './types';
import { AUTH_STORAGE_KEY, TENANT_STORAGE_KEY } from './types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

let authToken = '';

export function getAuthToken(): string {
  return authToken;
}

export function setAuthToken(token: string): void {
  authToken = token;
  sessionStorage.setItem(AUTH_STORAGE_KEY, token);
  client.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function clearAuthToken(): void {
  authToken = '';
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  delete client.defaults.headers.common.Authorization;
}

export function restoreAuthToken(): void {
  const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (stored) setAuthToken(stored);
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? '';
      if (!url.includes('/auth/login')) {
        clearAuthToken();
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

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

export async function loginWithPin(pin: string) {
  const res = await axios.post('/api/auth/login', { pin });
  return res.data as { token: string };
}

export async function verifySession() {
  const res = await client.get('/auth/session');
  return res.data as { authenticated: boolean };
}

export async function logout() {
  try {
    await client.post('/auth/logout');
  } finally {
    clearAuthToken();
  }
}

export async function getTenants(): Promise<{
  tenants: Tenant[];
  defaultTenantId: string;
  allTenantId: string;
  supportsAllTenants: boolean;
}> {
  const res = await client.get('/tenants');
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
    resolved?: ResolvedKnockoutMatch[];
    tenant?: Tenant;
    outcomes?: Array<{
      tenant: Tenant;
      ok: boolean;
      error?: string;
    }>;
  };
}

export async function getGroupStandings() {
  const res = await client.get('/group-standings');
  return res.data as {
    standings: GroupStandingRow[];
    tenant?: Tenant;
    previewTenantId?: string;
  };
}

export async function resolveKnockoutTeams() {
  const res = await client.post('/local-admin/resolve-knockout-teams');
  return res.data as {
    message: string;
    resolved: ResolvedKnockoutMatch[];
    tenant?: Tenant;
    outcomes?: Array<{
      tenant: Tenant;
      ok: boolean;
      resolved?: ResolvedKnockoutMatch[];
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

export async function applyGroupChampion(group: string, teamId: string) {
  const res = await client.post('/local-admin/tournament-results/group', { group, teamId });
  return res.data as {
    message: string;
    group: string;
    teamId: string;
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
