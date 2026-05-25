import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { finalizeMatch } from '../api';
import type { Match } from '../types';

interface AdminMatchCardProps {
  match: Match;
  onFinalized: (updated: Match) => void;
}

const AdminMatchCard: React.FC<AdminMatchCardProps> = ({ match, onFinalized }) => {
  const [team1Score, setTeam1Score] = useState<string>(
    match.team1Score != null ? String(match.team1Score) : ''
  );
  const [team2Score, setTeam2Score] = useState<string>(
    match.team2Score != null ? String(match.team2Score) : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setTeam1Score(match.team1Score != null ? String(match.team1Score) : '');
    setTeam2Score(match.team2Score != null ? String(match.team2Score) : '');
  }, [match.matchId, match.team1Score, match.team2Score]);

  const t1 = match.team1Info?.teamName ?? match.team1;
  const t2 = match.team2Info?.teamName ?? match.team2;
  const isCompleted = match.status === 'completed';

  const handleSubmit = async () => {
    if (team1Score === '' || team2Score === '') {
      setError('Enter both final scores');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { match: updated } = await finalizeMatch(
        match.matchId,
        Number(team1Score),
        Number(team2Score)
      );
      setSuccess('Scores saved — user points recalculated');
      onFinalized(updated);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(message || 'Failed to finalize match');
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {match.matchTag || 'Match'}
          </p>
          <h3 className="font-display text-base font-bold text-slate-900">
            {t1} vs {t2}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {format(new Date(match.matchTime), 'MMM dd, yyyy · h:mm a')}
            {match.round ? ` · ${match.round}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
            isCompleted
              ? 'bg-slate-200 text-slate-700'
              : match.status === 'ongoing'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
          }`}
        >
          {match.status}
        </span>
      </div>

      <div className="flex items-center justify-center gap-3 py-2">
        <input
          type="number"
          min={0}
          max={20}
          value={team1Score}
          onChange={(e) => setTeam1Score(e.target.value)}
          className="w-14 h-14 rounded-xl border border-slate-200 text-center text-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          aria-label={`${t1} score`}
        />
        <span className="text-lg font-bold text-slate-300">–</span>
        <input
          type="number"
          min={0}
          max={20}
          value={team2Score}
          onChange={(e) => setTeam2Score(e.target.value)}
          className="w-14 h-14 rounded-xl border border-slate-200 text-center text-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          aria-label={`${t2} score`}
        />
      </div>

      {error && (
        <p className="mb-2 text-center text-xs font-medium text-red-600">{error}</p>
      )}
      {success && (
        <p className="mb-2 text-center text-xs font-medium text-emerald-600">{success}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="mt-2 w-full min-h-[44px] rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
      >
        {loading
          ? 'Saving…'
          : isCompleted
            ? 'Update result & recalculate points'
            : 'Submit final result'}
      </button>
    </article>
  );
};

export default AdminMatchCard;
