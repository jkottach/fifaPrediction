import React, { useState, useEffect, useMemo } from 'react';
import { Match, Prediction } from '../types';
import { format } from 'date-fns';
import { apiService } from '../services/apiService';
import { getPredictionDeadlineIso, isMatchOpenForPrediction } from '../utils/matchDeadline';
import { isMatchLive } from '../utils/matchStatus';
import { needsPenaltyWinner } from '../utils/knockout';
import {
  GOAL_SCORE_MAX,
  GoalScoreInput,
  isValidGoalScore,
  normalizeGoalScore,
  parseGoalScoreInput,
} from '../utils/goalScore';
import PenaltyShootoutPicker from './PenaltyShootoutPicker';

interface MatchCardProps {
  match: Match;
  userPrediction?: Prediction;
  onPredictionSubmit?: (
    matchId: string,
    team1Score: number,
    team2Score: number,
    penaltyWinner?: string | null
  ) => void;
}

// ── Countdown hook ─────────────────────────────────────────────────────────────
function useCountdown(targetDate: string) {
  const calc = () => {
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) return null;
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    return { d, h, m, s };
  };
  const [remaining, setRemaining] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return remaining;
}

// ── Flag image with fallback ───────────────────────────────────────────────────
const Flag: React.FC<{ src?: string | null; alt: string }> = ({ src, alt }) => {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="w-11 h-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
        {alt.slice(0, 3)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErr(true)}
      className="w-11 h-11 rounded-full object-cover border-2 border-white/30 shadow-md shrink-0"
    />
  );
};

// ── Single countdown unit ──────────────────────────────────────────────────────
const CountUnit: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="flex flex-col items-center min-w-[1.8rem]">
    <span className="text-white font-black text-base leading-none tabular-nums">
      {String(value).padStart(2, '0')}
    </span>
    <span className="text-white/40 text-[8px] uppercase tracking-widest mt-0.5">{label}</span>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
const MatchCard: React.FC<MatchCardProps> = ({ match, userPrediction, onPredictionSubmit }) => {
  const isCompleted = match.status === 'completed';
  const isOngoing = isMatchLive(match);
  const isPredictionOpen = !isOngoing && !isCompleted && isMatchOpenForPrediction(match);
  const predictionDeadlineIso = getPredictionDeadlineIso(match) ?? match.predictionsEndingTime;

  const [team1Score, setTeam1Score] = useState<GoalScoreInput>('');
  const [team2Score, setTeam2Score] = useState<GoalScoreInput>('');
  const [penaltyWinner, setPenaltyWinner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const countdown = useCountdown(predictionDeadlineIso ?? match.matchTime);

  const showPenaltyPicker = useMemo(() => {
    if (!isValidGoalScore(team1Score) || !isValidGoalScore(team2Score)) return false;
    return needsPenaltyWinner(match, team1Score, team2Score);
  }, [match, team1Score, team2Score]);

  useEffect(() => {
    if (userPrediction) {
      setTeam1Score(normalizeGoalScore(userPrediction.team1Score));
      setTeam2Score(normalizeGoalScore(userPrediction.team2Score));
      setPenaltyWinner(userPrediction.penaltyWinner ?? null);
    } else {
      setTeam1Score('');
      setTeam2Score('');
      setPenaltyWinner(null);
    }
  }, [userPrediction]);

  useEffect(() => {
    if (!showPenaltyPicker) setPenaltyWinner(null);
  }, [showPenaltyPicker]);

  const scoresValid = isValidGoalScore(team1Score) && isValidGoalScore(team2Score);
  const displayPenaltyWinner = penaltyWinner ?? userPrediction?.penaltyWinner ?? null;
  const canSubmit =
    isPredictionOpen && scoresValid && (!showPenaltyPicker || Boolean(displayPenaltyWinner));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      const response = await apiService.submitPrediction({
        matchId: match.matchId,
        team1Score,
        team2Score,
        comment: '',
        ...(displayPenaltyWinner ? { penaltyWinner: displayPenaltyWinner } : {}),
      });
      const savedPenaltyWinner =
        response.data?.prediction?.penaltyWinner ?? displayPenaltyWinner ?? null;
      if (savedPenaltyWinner) setPenaltyWinner(savedPenaltyWinner);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2500);
      if (onPredictionSubmit) {
        onPredictionSubmit(match.matchId, team1Score, team2Score, savedPenaltyWinner);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  const t1Name = match.team1Info?.teamName ?? match.team1;
  const t2Name = match.team2Info?.teamName ?? match.team2;
  const roundStr = String(match.round ?? '').trim();
  const roundLabel = roundStr
    ? /^\d+$/.test(roundStr)
      ? `Round ${roundStr}`
      : roundStr
    : 'Round';
  const groupLabel = match.group
    ? /^group\s+/i.test(match.group.trim())
      ? match.group.trim()
      : `Group ${match.group.trim()}`
    : null;

  const statusBadge = isCompleted
    ? <span className="px-2 py-0.5 rounded-full bg-gray-500/70 text-[10px] font-bold text-white">Full Time</span>
    : isOngoing
    ? <span className="px-2 py-0.5 rounded-full bg-green-500/80 text-[10px] font-bold text-white animate-pulse">● Live</span>
    : <span className="px-2 py-0.5 rounded-full bg-emerald-500/70 text-[10px] font-bold text-white">Upcoming</span>;

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 hover:border-emerald-400/30 transition-all duration-300 hover:shadow-emerald-900/20"
      style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1a2744 50%, #0c1a1a 100%)' }}
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 70% 50% at 50% 50%, #ffffff 0%, transparent 70%), ' +
            'repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255,255,255,1) 28px, rgba(255,255,255,1) 29px)',
        }}
      />

      <div className="relative z-10 flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest truncate max-w-[120px]">
          {match.matchTag || 'Group Stage'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {groupLabel && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/25 text-[10px] font-semibold text-indigo-100 border border-indigo-300/25">
              {groupLabel}
            </span>
          )}
          <span className="text-[10px] text-white/30 font-medium">{roundLabel}</span>
          {statusBadge}
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 py-2 gap-1.5">
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <Flag src={match.team1Info?.countryLogo} alt={match.team1} />
          <span className="text-white font-bold text-[11px] text-center leading-tight line-clamp-2 max-w-[80px]">
            {t1Name}
          </span>
        </div>

        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <div className="flex items-center gap-1">
            {isCompleted ? (
              <>
                <div className="w-10 h-10 bg-white/10 border border-white/20 rounded-lg flex items-center justify-center text-white font-black text-lg">
                  {match.team1Score ?? 0}
                </div>
                <span className="text-white/40 font-bold text-sm">–</span>
                <div className="w-10 h-10 bg-white/10 border border-white/20 rounded-lg flex items-center justify-center text-white font-black text-lg">
                  {match.team2Score ?? 0}
                </div>
              </>
            ) : isOngoing ? (
              <>
                <div className="w-10 h-10 bg-white/10 border border-white/20 rounded-lg flex items-center justify-center text-white font-black text-lg">
                  {userPrediction ? userPrediction.team1Score : '–'}
                </div>
                <span className="text-white/40 font-bold text-sm">–</span>
                <div className="w-10 h-10 bg-white/10 border border-white/20 rounded-lg flex items-center justify-center text-white font-black text-lg">
                  {userPrediction ? userPrediction.team2Score : '–'}
                </div>
              </>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  max={GOAL_SCORE_MAX}
                  disabled={!isPredictionOpen || loading}
                  value={team1Score}
                  onChange={(e) => setTeam1Score(parseGoalScoreInput(e.target.value))}
                  placeholder="–"
                  autoComplete="off"
                  className="w-10 h-10 bg-white/10 border border-white/25 rounded-lg text-center text-white font-black text-lg focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400/40 disabled:opacity-40 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-white/30 font-bold text-sm">–</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  max={GOAL_SCORE_MAX}
                  disabled={!isPredictionOpen || loading}
                  value={team2Score}
                  onChange={(e) => setTeam2Score(parseGoalScoreInput(e.target.value))}
                  placeholder="–"
                  autoComplete="off"
                  className="w-10 h-10 bg-white/10 border border-white/25 rounded-lg text-center text-white font-black text-lg focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400/40 disabled:opacity-40 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </>
            )}
          </div>
          {isOngoing && (
            <span className="text-white/30 text-[8px] uppercase tracking-widest leading-none">
              {userPrediction ? 'Your Prediction' : 'No Prediction'}
            </span>
          )}
          {!isCompleted && !isOngoing && (
            <span className="text-white/30 text-[8px] uppercase tracking-widest leading-none">
              {isPredictionOpen ? 'Your Prediction' : 'Closed'}
            </span>
          )}
          {isCompleted && (
            <span className="text-white/30 text-[8px] uppercase tracking-widest leading-none">Final Score</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <Flag src={match.team2Info?.countryLogo} alt={match.team2} />
          <span className="text-white font-bold text-[11px] text-center leading-tight line-clamp-2 max-w-[80px]">
            {t2Name}
          </span>
        </div>
      </div>

      {error && (
        <p className="relative z-10 text-red-400 text-[11px] text-center px-4 -mt-1 mb-1 font-medium">{error}</p>
      )}

      {showPenaltyPicker && isPredictionOpen && !isOngoing && !isCompleted && (
        <div className="relative z-10 px-4 pb-3">
          <PenaltyShootoutPicker
            team1={{
              teamId: match.team1,
              teamName: t1Name,
              countryLogo: match.team1Info?.countryLogo,
            }}
            team2={{
              teamId: match.team2,
              teamName: t2Name,
              countryLogo: match.team2Info?.countryLogo,
            }}
            selectedTeamId={displayPenaltyWinner}
            onSelect={setPenaltyWinner}
            disabled={loading}
            variant="dark"
          />
        </div>
      )}

      {(isOngoing || isCompleted) &&
        userPrediction &&
        userPrediction.team1Score === userPrediction.team2Score &&
        displayPenaltyWinner && (
          <div className="relative z-10 px-4 pb-2">
            <p className="text-center text-[10px] text-emerald-400/80 font-semibold uppercase tracking-wider">
              Penalties ·{' '}
              <span className="text-emerald-300/90">
                {displayPenaltyWinner === match.team1 ? t1Name : t2Name} advances
              </span>
            </p>
          </div>
        )}

      <div className="relative z-10 mx-4 border-t border-white/[0.08]" />

      <div className="relative z-10 flex items-start justify-between px-4 py-3 gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-white/35 text-[9px] uppercase tracking-widest">
            {isOngoing ? 'Started' : 'Kick-off'}
          </span>
          <span className="text-white/80 text-xs font-bold">
            {format(new Date(match.matchTime), 'MMM dd, yyyy · h:mm a')}
          </span>
        </div>

        {!isOngoing && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-white/35 text-[9px] uppercase tracking-widest text-right">
              {isPredictionOpen
                ? 'Prediction closes in'
                : isCompleted
                ? 'Match ended'
                : 'Prediction closed'}
            </span>
            {isPredictionOpen && countdown ? (
              <div className="flex items-end gap-1">
                {countdown.d > 0 && (
                  <>
                    <CountUnit value={countdown.d} label="d" />
                    <span className="text-white/30 font-bold text-sm leading-none pb-3">:</span>
                  </>
                )}
                <CountUnit value={countdown.h} label="h" />
                <span className="text-white/30 font-bold text-sm leading-none pb-3">:</span>
                <CountUnit value={countdown.m} label="m" />
                <span className="text-white/30 font-bold text-sm leading-none pb-3">:</span>
                <CountUnit value={countdown.s} label="s" />
              </div>
            ) : (
              <span className="text-white/40 text-xs font-semibold">
                {predictionDeadlineIso
                  ? format(new Date(predictionDeadlineIso), 'MMM dd, h:mm a')
                  : '—'}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 px-4 pb-4">
        {isOngoing ? (
          <div className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-center text-white/30 text-sm font-bold tracking-wide">
            Match in progress
          </div>
        ) : !isCompleted ? (
          <button
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            className={`w-full py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 ${
              submitted
                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                : canSubmit
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98] shadow-lg shadow-emerald-500/30'
                : 'bg-white/8 text-white/25 cursor-not-allowed border border-white/10'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Submitting…
              </span>
            ) : submitted ? (
              '✓ Prediction Saved!'
            ) : isPredictionOpen ? (
              userPrediction ? 'Update Prediction' : 'Submit Prediction'
            ) : (
              'Prediction Closed'
            )}
          </button>
        ) : (
          <div className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-center text-white/30 text-sm font-bold tracking-wide">
            Full Time
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchCard;
