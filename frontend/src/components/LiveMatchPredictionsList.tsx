import React, { useMemo, useState } from 'react';
import { Match, LiveMatchPredictionEntry } from '../types';
import {
  predictionCardBg,
  predictionCardPitchStyle,
  predictionCardShell,
} from '../theme';

interface LiveMatchPredictionsListProps {
  match: Match;
  predictions: LiveMatchPredictionEntry[];
  currentUserId?: string;
}

function scorelineKey(team1Score: number, team2Score: number): string {
  return `${team1Score}-${team2Score}`;
}

const LiveMatchPredictionsList: React.FC<LiveMatchPredictionsListProps> = ({
  match,
  predictions,
  currentUserId,
}) => {
  const [expanded, setExpanded] = useState(false);

  const topScoreline = useMemo(() => {
    if (predictions.length === 0) return null;

    const counts = new Map<string, { team1Score: number; team2Score: number; count: number }>();
    for (const p of predictions) {
      const key = scorelineKey(p.team1Score, p.team2Score);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { team1Score: p.team1Score, team2Score: p.team2Score, count: 1 });
      }
    }

    let best: { team1Score: number; team2Score: number; count: number } | null = null;
    for (const entry of counts.values()) {
      if (!best || entry.count > best.count) {
        best = entry;
      }
    }
    return best;
  }, [predictions]);

  const team1Label = match.team1Info?.teamName ?? match.team1;
  const team2Label = match.team2Info?.teamName ?? match.team2;

  return (
    <div className={predictionCardShell} style={predictionCardBg}>
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={predictionCardPitchStyle}
      />

      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="relative z-10 flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition"
        aria-expanded={expanded}
      >
        <span className="text-sm font-semibold text-white">
          Kanhans Picks ({predictions.length})
        </span>
        <span className="text-xs font-medium text-emerald-400">
          {expanded ? 'Hide' : 'Show'}
        </span>
      </button>

      {expanded && (
        <div className="relative z-10 border-t border-white/10">
          {topScoreline && topScoreline.count > 1 && (
            <p className="px-4 py-2 text-xs text-white/50 bg-white/5 border-b border-white/10">
              Most picked: {topScoreline.team1Score} – {topScoreline.team2Score} ({topScoreline.count}{' '}
              {topScoreline.count === 1 ? 'person' : 'people'})
            </p>
          )}

          {predictions.length > 0 ? (
            <div className="divide-y divide-white/10">
              {predictions.map((entry) => {
                const isCurrentUser = currentUserId === entry.userId;
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      isCurrentUser ? 'bg-emerald-500/10' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {entry.name}
                        {isCurrentUser ? (
                          <span className="ml-1.5 text-xs font-normal text-emerald-400">(you)</span>
                        ) : null}
                      </p>
                      {entry.comment ? (
                        <p className="mt-0.5 truncate text-xs italic text-white/40">
                          &ldquo;{entry.comment}&rdquo;
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-display text-lg font-bold text-white tabular-nums">
                      {entry.team1Score} – {entry.team2Score}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-white/60">
                No predictions submitted for {team1Label} vs {team2Label}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LiveMatchPredictionsList;
