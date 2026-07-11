import React from 'react';
import { TOURNAMENT_GROUPS } from '../constants/tournamentTeams';
import { TournamentPrediction } from '../types';
import {
  championPickResult,
  groupPickBorderClass,
  groupPickResult,
  knockoutPickResult,
} from '../utils/tournamentPicks';

const sectionLabel =
  'mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400';
const teamPill =
  'rounded-lg border px-2 py-1.5 text-center text-xs font-bold text-slate-900';

export interface TournamentPredictionDisplayProps {
  prediction: TournamentPrediction;
  officialGroupChampions: Record<string, string>;
  officialSemifinalists?: string[];
  officialFinalists?: string[];
  officialChampion?: string;
  showPoints?: boolean;
  className?: string;
}

const TournamentPredictionDisplay: React.FC<TournamentPredictionDisplayProps> = ({
  prediction,
  officialGroupChampions,
  officialSemifinalists = [],
  officialFinalists = [],
  officialChampion = '',
  showPoints = true,
  className = '',
}) => {
  const groupPicks = prediction.groupChampions ?? [];
  const groupPickByLetter = new Map(groupPicks.map((pick) => [pick.group, pick]));

  return (
    <div className={className}>
      {showPoints && (
        <div className="mb-4 flex justify-end border-b border-slate-100 pb-4">
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              Points
            </p>
            <p className="font-display text-2xl font-bold tabular-nums text-emerald-600">
              {prediction.points ?? 0}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <p className={sectionLabel}>Group champions</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {TOURNAMENT_GROUPS.map(({ group }) => {
              const pick = groupPickByLetter.get(group);
              const result = groupPickResult(
                group,
                pick?.teamId ?? '',
                officialGroupChampions
              );
              return (
                <div key={group}>
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                    Group {group}
                  </p>
                  <div className={`${teamPill} ${groupPickBorderClass(result)}`}>
                    {pick?.teamName ?? '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className={sectionLabel}>Semifinalists</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {prediction.semifinalists.map((team, index) => {
              const result = knockoutPickResult(team?.teamId ?? '', officialSemifinalists, 4);
              return (
                <div key={`semi-${index}`} className={`${teamPill} ${groupPickBorderClass(result)}`}>
                  {team?.teamName ?? '—'}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className={sectionLabel}>Finalists</p>
          <div className="grid grid-cols-2 gap-2">
            {prediction.finalists.map((team, index) => {
              const result = knockoutPickResult(team?.teamId ?? '', officialFinalists, 2);
              return (
                <div key={`final-${index}`} className={`${teamPill} ${groupPickBorderClass(result)}`}>
                  {team?.teamName ?? '—'}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className={sectionLabel}>Champion</p>
          <div
            className={`${teamPill} ${groupPickBorderClass(
              championPickResult(prediction.champion?.teamId ?? '', officialChampion)
            )}`}
          >
            {prediction.champion?.teamName ?? '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentPredictionDisplay;
