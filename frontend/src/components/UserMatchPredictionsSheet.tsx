import React from 'react';
import { format } from 'date-fns';
import { Match, Prediction } from '../types';
import { cardPad } from '../theme';

const statCell =
  'rounded-lg border border-slate-100 bg-slate-50 px-1.5 py-2 text-center';
const statLabel =
  'mb-0.5 text-[9px] font-semibold leading-tight text-slate-500';
const statValue = 'font-display text-sm font-bold leading-tight text-slate-900 tabular-nums';
const statValueMono =
  'font-mono text-sm font-bold leading-tight text-slate-900 tabular-nums';

interface UserMatchPredictionsSheetProps {
  name: string;
  predictions: Prediction[];
  loading?: boolean;
  error?: string | null;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onClose: () => void;
}

const getPoints = (prediction: Prediction & { matchPoints?: number }): number | null => {
  if (prediction.matchPoints != null) return prediction.matchPoints;
  if (prediction.points != null) return prediction.points;
  const match = prediction.matchId;
  const isCompleted =
    typeof match === 'object' &&
    match !== null &&
    (match as Match).status === 'completed';
  return isCompleted ? 0 : null;
};

const UserMatchPredictionsSheet: React.FC<UserMatchPredictionsSheetProps> = ({
  name,
  predictions,
  loading = false,
  error = null,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-slate-50 shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-predictions-sheet-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2
            id="match-predictions-sheet-title"
            className="font-display text-base font-bold text-slate-900"
          >
            {name}&apos;s predictions
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-600">Loading predictions…</p>
          ) : error ? (
            <div className={`${cardPad} py-8 text-center`}>
              <p className="text-sm font-medium text-slate-600">{error}</p>
            </div>
          ) : predictions.length === 0 ? (
            <div className={`${cardPad} py-8 text-center`}>
              <p className="text-sm font-medium text-slate-600">
                {name} has no completed match predictions yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {predictions.map((prediction: Prediction & {
                id?: string;
                team1PredictedScore?: number;
                team2PredictedScore?: number;
              }) => {
                const match = prediction.matchId;
                const team1Name =
                  typeof match === 'object' && match !== null
                    ? match.team1Info?.teamName || match.team1
                    : 'Unknown';
                const team2Name =
                  typeof match === 'object' && match !== null
                    ? match.team2Info?.teamName || match.team2
                    : 'Unknown';
                const isCompleted =
                  typeof match === 'object' && match !== null && match.status === 'completed';
                const pred1 = prediction.team1PredictedScore ?? prediction.team1Score;
                const pred2 = prediction.team2PredictedScore ?? prediction.team2Score;
                const points = getPoints(prediction);
                const rank = prediction.overallRank;
                const previousRank = prediction.previousOverallRank;
                const rankTrend =
                  rank != null && previousRank != null && rank !== previousRank
                    ? rank < previousRank
                      ? 'up'
                      : 'down'
                    : null;

                return (
                  <article key={prediction.id ?? prediction._id} className={cardPad}>
                    <div className="mb-4 border-b border-slate-100 pb-4">
                      <h3 className="font-display text-[15px] font-bold text-slate-900">
                        {team1Name} vs {team2Name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {typeof match === 'object' &&
                        match !== null &&
                        match.matchTime
                          ? format(new Date(match.matchTime), 'MMM dd, yyyy · HH:mm')
                          : '—'}
                      </p>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      <div className={statCell}>
                        <p className={statLabel}>Prediction</p>
                        <p className={statValueMono}>
                          {pred1 != null && pred2 != null ? `${pred1} - ${pred2}` : '—'}
                        </p>
                      </div>
                      <div className={statCell}>
                        <p className={statLabel}>Actual</p>
                        <p className={`${statValueMono} text-slate-700`}>
                          {isCompleted &&
                          typeof match === 'object' &&
                          match !== null
                            ? `${match.team1Score} - ${match.team2Score}`
                            : '—'}
                        </p>
                      </div>
                      <div className={statCell}>
                        <p className={statLabel}>Points</p>
                        <p className={statValue}>{points != null ? points : '—'}</p>
                      </div>
                      <div className={statCell}>
                        <p className={statLabel}>Total pts</p>
                        <p className={statValue}>
                          {prediction.totalPoints != null ? prediction.totalPoints : '—'}
                        </p>
                      </div>
                      <div className={statCell}>
                        <p className={statLabel}>Rank</p>
                        <div className={`flex items-center justify-center gap-0.5 ${statValue}`}>
                          {rankTrend === 'up' ? (
                            <span className="text-emerald-600" aria-label="Rank improved">
                              ↑
                            </span>
                          ) : rankTrend === 'down' ? (
                            <span className="text-red-500" aria-label="Rank dropped">
                              ↓
                            </span>
                          ) : null}
                          <span>{rank != null ? rank : '—'}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {hasMore && onLoadMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default UserMatchPredictionsSheet;
