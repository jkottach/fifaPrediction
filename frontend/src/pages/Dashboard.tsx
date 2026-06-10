import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { loginWithGoogle, useAzureAuth } from '../services/swaAuth';
import { apiService } from '../services/apiService';
import { Match, Prediction } from '../types';
import MatchCard from '../components/MatchCard';
import TournamentPredictions from '../components/TournamentPredictions';
import PageHero from '../components/PageHero';
import { isMatchOpenForPrediction } from '../utils/matchDeadline';
import { alertError, cardPad, linkAccent, spinner } from '../theme';

interface UserRankInfo {
  rank: string | number;
  totalPoints: number;
}

const defaultRankInfo: UserRankInfo = { rank: '-', totalPoints: 0 };

const pickRank = (data: { final?: UserRankInfo; overall?: UserRankInfo } | undefined): UserRankInfo =>
  data?.final ?? data?.overall ?? defaultRankInfo;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user, authReady } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPredictions, setUserPredictions] = useState<Prediction[]>([]);
  const [myRank, setMyRank] = useState<UserRankInfo>(defaultRankInfo);
  const [loadError, setLoadError] = useState('');

  const getPredictionMatchId = (prediction: Prediction): string =>
    typeof prediction.matchId === 'string' ? prediction.matchId : prediction.matchId.matchId;

  useEffect(() => {
    if (!authReady) return;
    if (!isLoggedIn) {
      if (useAzureAuth) {
        loginWithGoogle('/dashboard');
      } else {
        navigate('/login?signed_out=1', { replace: true });
      }
      return;
    }
    loadDashboardData();
  }, [authReady, isLoggedIn, navigate]);

  const loadDashboardData = async () => {
    setLoading(true);
    setLoadError('');

    const [matchesResult, predictionsResult, statsResult] = await Promise.allSettled([
      apiService.getAllMatches('scheduled', 1, 104),
      apiService.getUserPredictions(1, 100),
      apiService.getUserStats(),
    ]);

    const errors: string[] = [];

    if (matchesResult.status === 'fulfilled') {
      setMatches(matchesResult.value.data?.matches ?? []);
    } else {
      console.error('Failed to load matches:', matchesResult.reason);
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

    if (errors.length > 0) {
      setLoadError(
        errors.includes('matches')
          ? 'Could not load matches. Pull down to refresh or try again in a moment.'
          : 'Some dashboard data could not be loaded. Please refresh.'
      );
    }

    setLoading(false);
  };

  const handlePredictionSubmit = (matchId: string, team1Score: number, team2Score: number) => {
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
      };
      return [optimisticPrediction, ...prev];
    });

    void apiService
      .getUserStats()
      .then((statsRes) => setMyRank(pickRank(statsRes.data)))
      .catch(() => undefined);
  };

  const displayMatches = useMemo(() => {
    const now = Date.now();

    return [...matches]
      .filter((m) => {
        const status = String(m.status || '').trim().toLowerCase();
        if (status !== 'scheduled' && status !== 'ongoing') return false;
        return isMatchOpenForPrediction(m, now);
      })
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .slice(0, 24);
  }, [matches]);

  const rankDisplay = myRank.rank === '-' ? '–' : `#${myRank.rank}`;

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

        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">Tournament predictions</h2>
          <TournamentPredictions />
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">Matches to predict</h2>

          {loading ? (
            <div className="flex flex-col items-center py-12">
              <div className={spinner} />
              <p className="mt-4 text-sm text-slate-600">Loading matches...</p>
            </div>
          ) : displayMatches.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {displayMatches.map((match) => {
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
            <div className={`${cardPad} text-center py-10 text-slate-600 text-sm`}>
              No open matches to predict right now
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
