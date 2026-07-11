import React, { useMemo, useState } from 'react';
import { CommunityTournamentPick } from '../types';
import { cardPad } from '../theme';
import TournamentPredictionDisplay from './TournamentPredictionDisplay';

export type CommunityTournamentSort = 'points' | 'name' | 'champion';

interface CommunityTournamentUserListProps {
  picks: CommunityTournamentPick[];
  officialGroupChampions: Record<string, string>;
  officialSemifinalists?: string[];
  officialFinalists?: string[];
  officialChampion?: string;
  currentUserId?: string;
  sort: CommunityTournamentSort;
}

const medal = (rank: number) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
};

const CommunityTournamentUserList: React.FC<CommunityTournamentUserListProps> = ({
  picks,
  officialGroupChampions,
  officialSemifinalists = [],
  officialFinalists = [],
  officialChampion = '',
  currentUserId,
  sort,
}) => {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const sortedPicks = useMemo(() => {
    const copy = [...picks];
    if (sort === 'name') {
      copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    } else if (sort === 'champion') {
      copy.sort((a, b) =>
        a.champion.teamName.localeCompare(b.champion.teamName, undefined, { sensitivity: 'base' })
      );
    }
    return copy;
  }, [picks, sort]);

  const filteredPicks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedPicks;
    return sortedPicks.filter(
      (pick) =>
        pick.name.toLowerCase().includes(q) ||
        pick.champion.teamName.toLowerCase().includes(q)
    );
  }, [sortedPicks, search]);

  const showSearch = picks.length >= 20;

  const toggleExpanded = (userId: string) => {
    setExpandedUserId((current) => (current === userId ? null : userId));
  };

  if (picks.length === 0) {
    return (
      <div className={`${cardPad} py-10 text-center`}>
        <p className="text-sm font-medium text-slate-600">
          No one has submitted tournament picks yet.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {showSearch && (
        <div className="border-b border-slate-100 px-4 py-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or champion pick…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
          />
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {filteredPicks.map((pick, index) => {
          const isCurrentUser = currentUserId === pick.userId;
          const isExpanded = expandedUserId === pick.userId;
          const rank = index + 1;

          return (
            <div key={pick.userId} className={isCurrentUser ? 'bg-emerald-50/60' : ''}>
              <button
                type="button"
                onClick={() => toggleExpanded(pick.userId)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80 transition"
                aria-expanded={isExpanded}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-10 shrink-0 font-display font-bold text-slate-900">
                    {medal(rank) || `#${rank}`}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {pick.name}
                      {isCurrentUser ? (
                        <span className="ml-1.5 text-xs font-normal text-emerald-600">(you)</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-slate-500">{pick.champion.teamName}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-display text-lg font-bold text-emerald-600 tabular-nums">
                    {pick.points} pts
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    {isExpanded ? 'Hide' : 'Show'}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 bg-white px-4 py-4">
                  <TournamentPredictionDisplay
                    prediction={pick}
                    officialGroupChampions={officialGroupChampions}
                    officialSemifinalists={officialSemifinalists}
                    officialFinalists={officialFinalists}
                    officialChampion={officialChampion}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredPicks.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">No players match your search.</p>
      )}
    </div>
  );
};

export default CommunityTournamentUserList;
