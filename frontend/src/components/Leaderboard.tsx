import React from 'react';
import { LeaderboardEntry } from '../types';
import { HERO_BG } from '../theme';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  title: string;
  onEntryClick?: (entry: LeaderboardEntry) => void;
}

const rankColorClass = (rankTrend?: LeaderboardEntry['rankTrend']) => {
  if (rankTrend === 'up') return 'text-emerald-600';
  if (rankTrend === 'down') return 'text-red-500';
  return 'text-slate-900';
};

const Leaderboard: React.FC<LeaderboardProps> = ({ entries, title, onEntryClick }) => {
  const medal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-4 py-3 text-white" style={{ background: HERO_BG }}>
        <h2 className="font-display text-base font-bold">{title}</h2>
        {onEntryClick ? (
          <p className="mt-0.5 text-xs text-white/70">Tap a player to view match predictions</p>
        ) : null}
      </div>

      <div className="divide-y divide-slate-100">
        {entries.map((entry) => {
          const RowTag = onEntryClick ? 'button' : 'div';
          return (
            <RowTag
              key={String(entry.userId ?? entry.email ?? `row-${entry.rank}`)}
              type={onEntryClick ? 'button' : undefined}
              onClick={onEntryClick ? () => onEntryClick(entry) : undefined}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
                entry.rank <= 3 ? 'bg-emerald-50/60' : ''
              } ${onEntryClick ? 'hover:bg-slate-50 transition cursor-pointer' : ''}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`w-10 shrink-0 font-display font-bold ${rankColorClass(entry.rankTrend)}`}
                >
                  {medal(entry.rank) || entry.rank}
                </span>
                <p className="truncate font-medium text-slate-900">{entry.name}</p>
              </div>
              <span className="shrink-0 font-display font-bold text-emerald-600">
                {entry.totalPoints}
              </span>
            </RowTag>
          );
        })}
        {entries.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No entries yet</p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
