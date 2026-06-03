import React, { useCallback, useEffect, useState } from 'react';
import AdminMatchCard from '../components/AdminMatchCard';
import { getAllMatches, getTopLeaderboard } from '../api';
import { ALL_TENANT_ID } from '../types';
import type { Match, MatchStatusFilter, Tenant } from '../types';

const FILTERS: { id: MatchStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'ongoing', label: 'Live' },
  { id: 'completed', label: 'Completed' },
];

interface MatchesProps {
  selectedTenantId: string;
  isAllTenants: boolean;
  activeTenant: Tenant | null;
  tenants: Tenant[];
  tenantsLoading: boolean;
  onError: (message: string) => void;
}

const Matches: React.FC<MatchesProps> = ({
  selectedTenantId,
  isAllTenants,
  activeTenant,
  tenants,
  tenantsLoading,
  onError,
}) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<MatchStatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leaderboard, setLeaderboard] = useState<
    Array<{ rank: number; name: string; totalPoints: number }>
  >([]);

  const loadMatches = useCallback(async () => {
    if (!selectedTenantId) return;
    setLoading(true);
    setError('');
    onError('');
    try {
      const status = filter === 'all' ? undefined : filter;
      const { matches: list } = await getAllMatches(status, 1, 100);
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
      const msg = message || 'Failed to load matches.';
      setError(msg);
      onError(msg);
    } finally {
      setLoading(false);
    }
  }, [filter, selectedTenantId, onError]);

  const loadLeaderboard = useCallback(async () => {
    if (!selectedTenantId || selectedTenantId === ALL_TENANT_ID) return;
    try {
      const { leaderboard: top } = await getTopLeaderboard(5);
      setLeaderboard(top.map((e) => ({ rank: e.rank, name: e.name, totalPoints: e.totalPoints })));
    } catch {
      setLeaderboard([]);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    if (!selectedTenantId) return;
    setMatches([]);
    setLeaderboard([]);
    void loadMatches();
  }, [loadMatches, selectedTenantId]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const handleFinalized = (updated: Match) => {
    setMatches((prev) => prev.map((m) => (m.matchId === updated.matchId ? updated : m)));
    void loadLeaderboard();
  };

  return (
    <div className="px-5 py-4 max-w-lg mx-auto">
      {(isAllTenants || (activeTenant && tenants.length > 1)) && (
        <p className="mb-3 text-xs text-slate-500 text-center">
          Active:{' '}
          <span className="font-semibold text-slate-700">
            {isAllTenants ? 'All apps' : activeTenant?.label}
          </span>
          {!isAllTenants && activeTenant && (
            <span className="text-slate-400"> · {activeTenant.dbName}</span>
          )}
          {isAllTenants && (
            <span className="text-slate-400"> · matches preview from Kanhans</span>
          )}
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
  );
};

export default Matches;
