import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { cardPad } from '../theme';

interface TournamentPicksLockedBannerProps {
  unlocksAt: string;
  hasSubmitted: boolean;
  submittedCount?: number;
  onGoToMine?: () => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'soon';
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const TournamentPicksLockedBanner: React.FC<TournamentPicksLockedBannerProps> = ({
  unlocksAt,
  hasSubmitted,
  submittedCount,
  onGoToMine,
}) => {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const unlockMs = new Date(unlocksAt).getTime();
    const tick = () => {
      setCountdown(formatCountdown(unlockMs - Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [unlocksAt]);

  const deadlineLabel = format(new Date(unlocksAt), 'MMM dd, yyyy · HH:mm');

  return (
    <div className={`${cardPad} text-center`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Community picks locked
      </p>
      <h2 className="mt-2 font-display text-lg font-bold text-slate-900">
        Unlocks in {countdown}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Everyone&apos;s tournament brackets stay hidden until the deadline on{' '}
        <span className="font-medium text-slate-800">{deadlineLabel}</span>.
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Your status:{' '}
        <span className={`font-semibold ${hasSubmitted ? 'text-emerald-600' : 'text-amber-600'}`}>
          {hasSubmitted ? 'Submitted' : 'Not yet submitted'}
        </span>
      </p>
      {submittedCount != null && submittedCount > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          {submittedCount} player{submittedCount === 1 ? '' : 's'} have submitted so far.
        </p>
      )}
      {onGoToMine && (
        <button
          type="button"
          onClick={onGoToMine}
          className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition"
        >
          {hasSubmitted ? 'View my tournament picks' : 'Go to my tournament picks'}
        </button>
      )}
    </div>
  );
};

export default TournamentPicksLockedBanner;
