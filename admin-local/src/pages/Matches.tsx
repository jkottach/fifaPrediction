import React, { useCallback, useEffect, useState } from 'react';
import AdminMatchCard from '../components/AdminMatchCard';
import TenantSelector from '../components/TenantSelector';
import {
  getAllMatches,
  getTenants,
  getTopLeaderboard,
  restoreTenantFromStorage,
  setActiveTenantId,
} from '../api';
import type { Match, MatchStatusFilter, Tenant } from '../types';

const FILTERS: { id: MatchStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'ongoing', label: 'Live' },
  { id: 'completed', label: 'Completed' },
];

const Matches: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<MatchStatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [error, setError] = useState('');
  const [leaderboard, setLeaderboard] = useState<
    Array<{ rank: number; name: string; totalPoints: number }>
  >([]);

  useEffect(() => {
    void (async () => {
      setTenantsLoading(true);
      try {
        const { tenants: list, defaultTenantId } = await getTenants();
        setTenants(list);
        const stored = restoreTenantFromStorage();
        const initial =
          stored && list.some((t) => t.id === stored) ? stored : defaultTenantId;
        setSelectedTenantId(initial);
        setActiveTenantId(initial);
      } catch {
        setError('Failed to load app list. Is the admin API running on port 5002?');
      } finally {
        setTenantsLoading(false);
      }
    })();
  }, []);

  const loadMatches = useCallback(async () => {
    if (!selectedTenantId) return;
    setLoading(true);
    setError('');
    try {
      const status = filter === 'all' ? undefined : filter;
      const { matches: list, tenant } = await getAllMatches(status, 1, 100);
      if (tenant) setActiveTenant(tenant);
      setMatches(
        [...list].sort(
          (a, b) => new Date(a.matchTime).getTime() - new Date(b.matchTime).getTime()
        )
      );
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(message || 'Failed to load matches. Run npm run dev (admin server on port 5002).');
    } finally {
      setLoading(false);
    }
  }, [filter, selectedTenantId]);

  const loadLeaderboard = useCallback(async () => {
    if (!selectedTenantId) return;
    try {
      const { leaderboard: top, tenant } = await getTopLeaderboard(5);
      if (tenant) setActiveTenant(tenant);
      setLeaderboard(top.map((e) => ({ rank: e.rank, name: e.name, totalPoints: e.totalPoints })));
    } catch {
      setLeaderboard([]);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    if (!selectedTenantId) return;
    void loadMatches();
  }, [loadMatches, selectedTenantId]);

  useEffect(() => {
    if (!selectedTenantId) return;
    void loadLeaderboard();
  }, [loadLeaderboard, selectedTenantId]);

  const handleTenantChange = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setActiveTenantId(tenantId);
    const tenant = tenants.find((t) => t.id === tenantId) ?? null;
    setActiveTenant(tenant);
    setMatches([]);
    setLeaderboard([]);
  };

  const handleFinalized = (updated: Match) => {
    setMatches((prev) => prev.map((m) => (m.matchId === updated.matchId ? updated : m)));
    void loadLeaderboard();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header
        className="px-5 py-6 text-white"
        style={{
          background: 'linear-gradient(180deg, #0b1220 0%, #111827 45%, #0f172a 100%)',
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-1">
          Local only · no auth
        </p>
        <h1 className="font-display text-2xl font-extrabold">Match results admin</h1>
        <p className="mt-1 text-sm text-slate-300">
          Select an app, enter final scores, and recalculate prediction points for that database.
        </p>

        {tenantsLoading ? (
          <p className="mt-4 text-xs text-slate-400">Loading apps…</p>
        ) : (
          <TenantSelector
            tenants={tenants}
            selectedId={selectedTenantId}
            onChange={handleTenantChange}
            disabled={loading}
          />
        )}
      </header>

      <div className="px-5 py-4 max-w-lg mx-auto">
        {activeTenant && tenants.length > 1 && (
          <p className="mb-3 text-xs text-slate-500 text-center">
            Active: <span className="font-semibold text-slate-700">{activeTenant.label}</span>
            <span className="text-slate-400"> · {activeTenant.dbName}</span>
          </p>
        )}

        {leaderboard.length > 0 && (
          <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-sm font-bold text-slate-900 mb-2">
              Top 5 leaderboard
              {activeTenant ? ` · ${activeTenant.label}` : ''}
            </h2>
            <ul className="space-y-1">
              {leaderboard.map((e) => (
                <li key={e.rank} className="flex justify-between text-sm">
                  <span className="text-slate-700">
                    #{e.rank} {e.name}
                  </span>
                  <span className="font-bold text-emerald-600">{e.totalPoints} pts</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading || tenantsLoading || !selectedTenantId ? (
          <p className="text-center text-sm text-slate-600 py-12">Loading matches…</p>
        ) : matches.length === 0 ? (
          <p className="text-center text-sm text-slate-600 py-12">No matches found</p>
        ) : (
          <div className="space-y-3 pb-8">
            {matches.map((match) => (
              <AdminMatchCard key={match.matchId} match={match} onFinalized={handleFinalized} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Matches;
