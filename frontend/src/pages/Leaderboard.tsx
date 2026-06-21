import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { LeaderboardEntry } from '../types';
import Leaderboard from '../components/Leaderboard';
import PageHero from '../components/PageHero';
import { spinner } from '../theme';

const LEADERBOARD_LIMIT = 50;

const LeaderboardPage: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const res = await apiService.getTopLeaderboard(LEADERBOARD_LIMIT);
      setLeaderboard(res.data.leaderboard || []);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      <PageHero
        title="Leaderboard"
        subtitle="Top 50 players ranked by total points"
        badge="Rankings"
      />

      <div className="px-5 py-6">
        {loading ? (
          <div className="flex flex-col items-center py-12">
            <div className={spinner} />
            <p className="mt-4 text-sm text-slate-600">Loading...</p>
          </div>
        ) : (
          <Leaderboard entries={leaderboard} title="Top 50 players" />
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage;
