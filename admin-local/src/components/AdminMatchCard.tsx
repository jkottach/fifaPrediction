import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { finalizeMatch, getActiveTenantId } from '../api';
import { ALL_TENANT_ID } from '../types';
import type { Match, ResolvedKnockoutMatch } from '../types';
import { formatResolvedKnockoutMessage, isPlaceholderTeamId } from '../utils/placeholders';

interface AdminMatchCardProps {
  match: Match;
  onFinalized: (updated: Match) => void;
  onKnockoutResolved?: (resolved: ResolvedKnockoutMatch[]) => void;
}

const AdminMatchCard: React.FC<AdminMatchCardProps> = ({
  match,
  onFinalized,
  onKnockoutResolved,
}) => {
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
  const hasPlaceholders =
    isPlaceholderTeamId(match.team1) || isPlaceholderTeamId(match.team2);

  const handleSubmit = async () => {
    if (team1Score === '' || team2Score === '') {
      setError('Enter both final scores');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { match: updated, message, outcomes, resolved } = await finalizeMatch(
        match.matchId,
        Number(team1Score),
        Number(team2Score),
        match.matchTag
      );
      const failed = outcomes?.filter((o) => !o.ok) ?? [];
      const knockoutMsg = formatResolvedKnockoutMessage(resolved ?? []);
      if (failed.length > 0) {
        setSuccess(
          `${message}. Failed: ${failed.map((f) => f.tenant.label).join(', ')}${knockoutMsg ? `. ${knockoutMsg}` : ''}`
        );
      } else {
        const base = message || 'Scores saved — user points recalculated';
        const completedHint =
          updated.status === 'completed' && match.status !== 'completed'
            ? ' Match is now under Completed.'
            : '';
        const full = `${base}${completedHint}`;
        setSuccess(knockoutMsg ? `${full}. ${knockoutMsg}` : full);
      }
      onFinalized(updated);
      if (resolved && resolved.length > 0) onKnockoutResolved?.(resolved);
      setTimeout(() => setSuccess(''), 6000);
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
        <div className="flex shrink-0 flex-col items-end gap-1">
          {hasPlaceholders && (
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-800">
              Placeholder
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
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
      </div>

      {isCompleted && match.team1Score != null && match.team2Score != null && (
        <p className="mb-2 text-center font-display text-2xl font-bold text-slate-900">
          {match.team1Score} – {match.team2Score}
        </p>
      )}

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
          : getActiveTenantId() === ALL_TENANT_ID
            ? isCompleted
              ? 'Update all databases'
              : 'Submit to all databases'
            : isCompleted
              ? 'Update result & recalculate points'
              : 'Submit final result'}
      </button>
    </article>
  );
};

export default AdminMatchCard;
