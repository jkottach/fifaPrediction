import React from 'react';
import { TOURNAMENT_GROUPS } from '../constants/tournamentTeams';
import { CommunityTournamentConsensus } from '../types';
import { cardPad } from '../theme';

interface TournamentConsensusPanelProps {
  consensus: CommunityTournamentConsensus;
  submittedCount: number;
}

const sectionLabel =
  'mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400';
const chip =
  'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800';

const TournamentConsensusPanel: React.FC<TournamentConsensusPanelProps> = ({
  consensus,
  submittedCount,
}) => {
  const topChampion = consensus.champion[0];
  const runnerUpChampions = consensus.champion.slice(1, 4);

  return (
    <div className={`${cardPad} space-y-5`}>
      <div>
        <p className={sectionLabel}>Most picked champion</p>
        {topChampion ? (
          <div className="space-y-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="font-display text-lg font-bold text-slate-900">
                {topChampion.teamName}
              </p>
              <p className="mt-0.5 text-sm text-slate-600 tabular-nums">
                {topChampion.pct ?? 0}% ({topChampion.count}/{submittedCount})
              </p>
            </div>
            {runnerUpChampions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {runnerUpChampions.map((entry) => (
                  <span key={entry.teamId} className={chip}>
                    {entry.teamName}
                    <span className="text-slate-500 tabular-nums">({entry.count})</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No champion picks yet.</p>
        )}
      </div>

      <div>
        <p className={sectionLabel}>Group winners</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TOURNAMENT_GROUPS.map(({ group }) => {
            const top = consensus.groupChampions[group]?.[0];
            return (
              <div
                key={group}
                className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2"
              >
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                  Group {group}
                </p>
                <p className="mt-0.5 truncate text-xs font-bold text-slate-900">
                  {top?.teamName ?? '—'}
                </p>
                {top ? (
                  <p className="text-[10px] text-slate-500 tabular-nums">{top.count} picks</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {(consensus.semifinalists.length > 0 || consensus.finalists.length > 0) && (
        <div className="space-y-3">
          {consensus.semifinalists.length > 0 && (
            <div>
              <p className={sectionLabel}>Top semifinalist picks</p>
              <div className="flex flex-wrap gap-2">
                {consensus.semifinalists.slice(0, 4).map((entry) => (
                  <span key={entry.teamId} className={chip}>
                    {entry.teamName}
                    <span className="text-slate-500 tabular-nums">({entry.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {consensus.finalists.length > 0 && (
            <div>
              <p className={sectionLabel}>Top finalist picks</p>
              <div className="flex flex-wrap gap-2">
                {consensus.finalists.slice(0, 2).map((entry) => (
                  <span key={entry.teamId} className={chip}>
                    {entry.teamName}
                    <span className="text-slate-500 tabular-nums">({entry.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TournamentConsensusPanel;
