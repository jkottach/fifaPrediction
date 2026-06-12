import React, { useCallback, useEffect, useState } from 'react';
import AdminMatchCard from '../components/AdminMatchCard';
import { getAllMatches, getGroupStandings, getTopLeaderboard, resolveKnockoutTeams } from '../api';
import { ALL_TENANT_ID } from '../types';
import type { GroupStandingRow, Match, MatchStatusFilter, Tenant } from '../types';
import { formatResolvedKnockoutMessage } from '../utils/placeholders';

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
  const [standings, setStandings] = useState<GroupStandingRow[]>([]);
  const [standingsOpen, setStandingsOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveMessage, setResolveMessage] = useState('');

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

  const loadStandings = useCallback(async () => {
    if (!selectedTenantId) return;
    try {
      const { standings: rows } = await getGroupStandings();
      setStandings(rows);
    } catch {
      setStandings([]);
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

  useEffect(() => {
    void loadStandings();
  }, [loadStandings]);

  const handleFinalized = (updated: Match) => {
    const sameMatch = (m: Match) =>
      m.matchId === updated.matchId ||
      (!!updated.matchTag && !!m.matchTag && m.matchTag === updated.matchTag);

    setMatches((prev) => prev.map((m) => (sameMatch(m) ? updated : m)));

    if (filter === 'ongoing' && updated.status === 'completed') {
      setFilter('completed');
    } else {
      void loadMatches();
    }

    void loadLeaderboard();
    void loadStandings();
  };

  const handleKnockoutResolved = () => {
    void loadMatches();
    void loadStandings();
  };

  const handleResolveKnockout = async () => {
    setResolving(true);
    setResolveMessage('');
    try {
      const { message, resolved } = await resolveKnockoutTeams();
      const knockoutMsg = formatResolvedKnockoutMessage(resolved ?? []);
      setResolveMessage(knockoutMsg ? `${message}. ${knockoutMsg}` : message);
      void loadMatches();
      void loadStandings();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setResolveMessage(msg || 'Failed to resolve knockout teams');
    } finally {
      setResolving(false);
      setTimeout(() => setResolveMessage(''), 6000);
    }
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

      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-display text-sm font-bold text-slate-900">Knockout resolution</h2>
          <button
            type="button"
            onClick={() => void handleResolveKnockout()}
            disabled={resolving || !selectedTenantId}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {resolving ? 'Resolving…' : 'Re-resolve teams'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          After group matches are finalized, placeholders like 2A vs 2B are filled automatically.
          Use re-resolve after bulk score updates.
        </p>
        {resolveMessage && (
          <p className="mt-2 text-xs font-medium text-emerald-600">{resolveMessage}</p>
        )}
      </section>

      {standings.length > 0 && (
        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setStandingsOpen((o) => !o)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="font-display text-sm font-bold text-slate-900">Group standings</h2>
            <span className="text-xs text-slate-500">{standingsOpen ? 'Hide' : 'Show'}</span>
          </button>
          {standingsOpen && (
            <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
              {standings.map((group) => (
                <div key={group.group}>
                  <p className="text-xs font-bold text-slate-700 mb-1">
                    Group {group.group}
                    {!group.complete && (
                      <span className="ml-2 font-normal text-amber-600">in progress</span>
                    )}
                  </p>
                  {group.ranked.length > 0 ? (
                    <>
                      {!group.complete && (
                        <p className="text-[10px] text-slate-400 mb-1">
                          Provisional — finalize all 6 group matches for confirmed order
                        </p>
                      )}
                      <ul className="space-y-0.5">
                        {group.ranked.map((row) => (
                          <li
                            key={row.teamId}
                            className="flex justify-between text-xs text-slate-600"
                          >
                            <span>
                              {row.position}. {row.teamId}
                            </span>
                            <span>
                              {row.points} pts · {row.goalDifference > 0 ? '+' : ''}
                              {row.goalDifference}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">No finalized group matches yet</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
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
            <AdminMatchCard
              key={match.matchId}
              match={match}
              onFinalized={handleFinalized}
              onKnockoutResolved={handleKnockoutResolved}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Matches;
