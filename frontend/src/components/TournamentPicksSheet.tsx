import React from 'react';
import { Link } from 'react-router-dom';
import { TournamentPrediction } from '../types';
import TournamentPredictionDisplay from './TournamentPredictionDisplay';
import { cardPad } from '../theme';

interface TournamentPicksSheetProps {
  name: string;
  prediction: TournamentPrediction | null;
  officialGroupChampions: Record<string, string>;
  loading?: boolean;
  error?: string | null;
  lockedMessage?: string | null;
  onClose: () => void;
}

const TournamentPicksSheet: React.FC<TournamentPicksSheetProps> = ({
  name,
  prediction,
  officialGroupChampions,
  loading = false,
  error = null,
  lockedMessage = null,
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
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tournament-picks-sheet-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="tournament-picks-sheet-title" className="font-display text-base font-bold text-slate-900">
            {name}&apos;s tournament picks
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
            <p className="py-8 text-center text-sm text-slate-600">Loading picks…</p>
          ) : lockedMessage ? (
            <div className={`${cardPad} py-8 text-center`}>
              <p className="text-sm font-medium text-slate-600">{lockedMessage}</p>
            </div>
          ) : error ? (
            <div className={`${cardPad} py-8 text-center`}>
              <p className="text-sm font-medium text-slate-600">{error}</p>
            </div>
          ) : !prediction ? (
            <div className={`${cardPad} py-8 text-center`}>
              <p className="text-sm font-medium text-slate-600">
                {name} has not submitted tournament picks.
              </p>
            </div>
          ) : (
            <TournamentPredictionDisplay
              prediction={prediction}
              officialGroupChampions={officialGroupChampions}
            />
          )}

          <Link
            to="/my-predictions"
            state={{ view: 'community' }}
            onClick={onClose}
            className="mt-4 block text-center text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            View all community picks →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TournamentPicksSheet;
