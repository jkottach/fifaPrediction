import axios from 'axios';
import type { Match } from './types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export async function getAllMatches(status?: string, page = 1, limit = 100) {
  const res = await client.get('/matches', { params: { status, page, limit } });
  return res.data as {
    matches: Match[];
    pagination: { total: number; page: number; limit: number; pages: number };
  };
}

export async function finalizeMatch(matchId: string, team1Score: number, team2Score: number) {
  const res = await client.post('/local-admin/finalize-match', {
    matchId,
    team1Score,
    team2Score,
  });
  return res.data as { message: string; match: Match };
}

export async function getTopLeaderboard(limit = 10) {
  const res = await client.get('/leaderboard/top', { params: { limit } });
  return res.data as {
    leaderboard: Array<{ rank: number; name: string; totalPoints: number; email: string }>;
  };
}
