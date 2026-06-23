import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAzureAuth } from '../services/swaAuth';
import { apiService } from '../services/apiService';
import { Match, Prediction, LiveMatchPredictionEntry } from '../types';
import MatchCard from '../components/MatchCard';
import LiveMatchPredictionsList from '../components/LiveMatchPredictionsList';
import PageHero from '../components/PageHero';
import {
  isLockedAwaitingKickoff,
  isMatchOpenForPrediction,
} from '../utils/matchDeadline';
import { isMatchLive, normalizeMatchStatus } from '../utils/matchStatus';
import { alertError, cardPad, linkAccent, spinner } from '../theme';

interface UserRankInfo {
  rank: string | number;
  totalPoints: number;
}

const defaultRankInfo: UserRankInfo = { rank: '-', totalPoints: 0 };

const pickRank = (data: { final?: UserRankInfo; overall?: UserRankInfo } | undefined): UserRankInfo =>
  data?.final ?? data?.overall ?? defaultRankInfo;

const sortByKickoff = (a: Match, b: Match) => {
  const ta = Date.parse(a.matchTime ?? '');
  const tb = Date.parse(b.matchTime ?? '');
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
  return (a.sequence ?? 0) - (b.sequence ?? 0);
};

/** Merge match lists; later sources win so ongoing/open-for-prediction data overrides stale scheduled copies. */
const mergeMatches = (...groups: Match[][]): Match[] => {
  const byId = new Map<string, Match>();
  for (const group of groups) {
    for (const m of group) {
      byId.set(m.matchId, m);
    }
  }
  return [...byId.values()];
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user, authReady } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPredictions, setUserPredictions] = useState<Prediction[]>([]);
  const [myRank, setMyRank] = useState<UserRankInfo>(defaultRankInfo);
  const [loadError, setLoadError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [livePredictionsByMatchId, setLivePredictionsByMatchId] = useState<
    Record<string, LiveMatchPredictionEntry[]>
  >({});

  const applyLivePredictionsResponse = (data: {
    matches?: Array<{ match: Match; predictions: LiveMatchPredictionEntry[] }>;
  }) => {
    const byId: Record<string, LiveMatchPredictionEntry[]> = {};
    for (const group of data.matches ?? []) {
      if (group.match?.matchId) {
        byId[group.match.matchId] = group.predictions ?? [];
      }
    }
    setLivePredictionsByMatchId(byId);
  };

  const getPredictionMatchId = (prediction: Prediction): string =>
    typeof prediction.matchId === 'string' ? prediction.matchId : prediction.matchId.matchId;

  useEffect(() => {
    if (!authReady) return;
    if (!isLoggedIn) {
      navigate(useAzureAuth ? '/login' : '/login?signed_out=1', { replace: true });
      return;
    }
    loadDashboardData();
  }, [authReady, isLoggedIn, navigate]);

  const refreshLiveMatches = useCallback(async () => {
    try {
      const [openResult, scheduledResult, ongoingResult, livePredictionsResult] =
        await Promise.allSettled([
          apiService.getOpenMatches(1, 50),
          apiService.getAllMatches('scheduled', 1, 100),
          apiService.getAllMatches('ongoing', 1, 20),
          apiService.getLiveMatchPredictions(),
        ]);

      const scheduled =
        scheduledResult.status === 'fulfilled' ? scheduledResult.value.data?.matches ?? [] : [];
      const ongoing = ongoingResult.status === 'fulfilled' ? ongoingResult.value.data?.matches ?? [] : [];
      const open = openResult.status === 'fulfilled' ? openResult.value.data?.matches ?? [] : [];

      if (livePredictionsResult.status === 'fulfilled') {
        applyLivePredictionsResponse(livePredictionsResult.value.data);
      }

      if (
        openResult.status !== 'fulfilled' &&
        scheduledResult.status !== 'fulfilled' &&
        ongoingResult.status !== 'fulfilled'
      ) {
        return;
      }

      setMatches((prev) => {
        const completed = prev.filter((m) => normalizeMatchStatus(m.status) === 'completed');
        return mergeMatches(scheduled, open, ongoing, completed);
      });
    } catch (error) {
      console.error('Failed to refresh live matches:', error);
    }
  }, []);

  useEffect(() => {
    if (!authReady || !isLoggedIn) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      void refreshLiveMatches();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [authReady, isLoggedIn, refreshLiveMatches]);

  const loadDashboardData = async () => {
    setLoading(true);
    setLoadError('');

    const errors: string[] = [];

    const [openResult, scheduledResult, ongoingResult, predictionsResult, statsResult, livePredictionsResult] =
      await Promise.allSettled([
        apiService.getOpenMatches(1, 50),
        apiService.getAllMatches('scheduled', 1, 100),
        apiService.getAllMatches('ongoing', 1, 20),
        apiService.getUserPredictions(1, 100),
        apiService.getUserStats(),
        apiService.getLiveMatchPredictions(),
      ]);

    const scheduled =
      scheduledResult.status === 'fulfilled' ? scheduledResult.value.data?.matches ?? [] : [];
    const ongoing = ongoingResult.status === 'fulfilled' ? ongoingResult.value.data?.matches ?? [] : [];
    const open = openResult.status === 'fulfilled' ? openResult.value.data?.matches ?? [] : [];

    if (
      openResult.status === 'fulfilled' ||
      scheduledResult.status === 'fulfilled' ||
      ongoingResult.status === 'fulfilled'
    ) {
      setMatches(mergeMatches(scheduled, open, ongoing));
    } else {
      console.error(
        'Failed to load matches:',
        openResult.reason ?? scheduledResult.reason ?? ongoingResult.reason
      );
      setMatches([]);
      errors.push('matches');
    }

    if (predictionsResult.status === 'fulfilled') {
      setUserPredictions(predictionsResult.value.data?.predictions ?? []);
    } else {
      console.error('Failed to load predictions:', predictionsResult.reason);
      errors.push('predictions');
    }

    if (statsResult.status === 'fulfilled') {
      setMyRank(pickRank(statsResult.value.data));
    } else {
      console.error('Failed to load stats:', statsResult.reason);
      errors.push('rank');
    }

    if (livePredictionsResult.status === 'fulfilled') {
      applyLivePredictionsResponse(livePredictionsResult.value.data);
    } else {
      console.error('Failed to load live predictions:', livePredictionsResult.reason);
    }

    if (errors.length > 0) {
      setLoadError(
        errors.includes('matches')
          ? 'Could not load matches. Pull down to refresh or try again in a moment.'
          : 'Some dashboard data could not be loaded. Please refresh.'
      );
    }

    setLoading(false);
  };

  const handlePredictionSubmit = (
    matchId: string,
    team1Score: number,
    team2Score: number,
    penaltyWinner?: string | null
  ) => {
    const submittedTime = new Date().toISOString();

    setUserPredictions((prev) => {
      const existingIndex = prev.findIndex((p) => getPredictionMatchId(p) === matchId);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          matchId,
          team1Score,
          team2Score,
          submittedTime,
          penaltyWinner: penaltyWinner ?? next[existingIndex].penaltyWinner ?? null,
        };
        return next;
      }

      const optimisticPrediction: Prediction = {
        _id: `optimistic-${matchId}`,
        userId: user?.userId || '',
        matchId,
        matchTag: '',
        team1Score,
        team2Score,
        submittedTime,
        points: 0,
        penaltyWinner: penaltyWinner ?? null,
      };
      return [optimisticPrediction, ...prev];
    });

    void apiService
      .getUserStats()
      .then((statsRes) => setMyRank(pickRank(statsRes.data)))
      .catch(() => undefined);
  };

  const liveMatches = useMemo(
    () => [...matches].filter((m) => isMatchLive(m, now)).sort(sortByKickoff),
    [matches, now]
  );

  const predictableMatches = useMemo(
    () =>
      [...matches]
        .filter((m) => {
          if (isMatchLive(m, now)) return false;
          if (normalizeMatchStatus(m.status) !== 'scheduled') return false;
          return (
            isMatchOpenForPrediction(m, now) || isLockedAwaitingKickoff(m, now)
          );
        })
        .sort(sortByKickoff)
        .slice(0, 24),
    [matches, now]
  );

  const rankDisplay = myRank.rank === '-' ? '–' : `#${myRank.rank}`;

  if (!authReady) {
    return (
      <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center py-20">
        <div className={spinner} />
        <p className="mt-4 text-sm text-slate-600">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <PageHero
        title={`Welcome, ${user?.firstName ?? 'Player'}!`}
        subtitle="Predict upcoming matches and climb the leaderboard"
        badge="Dashboard"
      />

      <div className="px-5 py-6 space-y-6">
        {loadError && <div className={alertError}>{loadError}</div>}

        <div
          className="rounded-2xl border border-emerald-500/20 p-5 text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #0f172a 100%)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100/80">My rank</p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="font-display text-3xl font-extrabold">{rankDisplay}</p>
            <span className="rounded-lg bg-white/15 px-3 py-1 text-sm font-bold">
              {myRank.totalPoints} pts
            </span>
          </div>
        </div>

        <Link
          to="/my-predictions"
          className={`${cardPad} flex items-center justify-between min-h-[56px] hover:border-emerald-300 transition`}
        >
          <span className="font-display font-bold text-slate-900">View previous predictions</span>
          <span className={linkAccent}>→</span>
        </Link>

        {liveMatches.length > 0 && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <h2 className="font-display text-lg font-bold text-slate-900">Live now</h2>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {liveMatches.map((match) => {
                const userPrediction = userPredictions.find(
                  (p) => getPredictionMatchId(p) === match.matchId
                );
                const showCommunityPicks =
                  isMatchLive(match, now) && !isMatchOpenForPrediction(match, now);
                return (
                  <div key={match.matchId} className="space-y-3">
                    <MatchCard
                      match={match}
                      userPrediction={userPrediction}
                      onPredictionSubmit={handlePredictionSubmit}
                    />
                    {showCommunityPicks ? (
                      <LiveMatchPredictionsList
                        match={match}
                        predictions={livePredictionsByMatchId[match.matchId] ?? []}
                        currentUserId={user?.userId}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">Matches to predict</h2>

          {loading ? (
            <div className="flex flex-col items-center py-12">
              <div className={spinner} />
              <p className="mt-4 text-sm text-slate-600">Loading matches...</p>
            </div>
          ) : predictableMatches.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {predictableMatches.map((match) => {
                const userPrediction = userPredictions.find(
                  (p) => getPredictionMatchId(p) === match.matchId
                );
                return (
                  <MatchCard
                    key={match.matchId}
                    match={match}
                    userPrediction={userPrediction}
                    onPredictionSubmit={handlePredictionSubmit}
                  />
                );
              })}
            </div>
          ) : (
            <div className={`${cardPad} text-center py-10 text-slate-600 text-sm space-y-2`}>
              <p>No open matches to predict right now.</p>
              {matches.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No matches were loaded. Confirm the API is running and check{' '}
                  <code className="text-emerald-700">/api/health</code> shows your database.
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Predictions close at each match&apos;s deadline (usually just before kickoff). Later
                  fixtures may still open even when earlier ones have closed.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
