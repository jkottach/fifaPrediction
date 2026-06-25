import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { apiService } from '../services/apiService';
import { LeaderboardEntry, TournamentPrediction } from '../types';
import Leaderboard from '../components/Leaderboard';
import PageHero from '../components/PageHero';
import TournamentPicksSheet from '../components/TournamentPicksSheet';
import { spinner } from '../theme';

const LEADERBOARD_LIMIT = 50;
const LEADERBOARD_REFRESH_MS = 2 * 60 * 60 * 1000;

const LeaderboardPage: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetPrediction, setSheetPrediction] = useState<TournamentPrediction | null>(null);
  const [sheetOfficialGroups, setSheetOfficialGroups] = useState<Record<string, string>>({});
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetLockedMessage, setSheetLockedMessage] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      const res = await apiService.getTopLeaderboard(LEADERBOARD_LIMIT);
      setLeaderboard(res.data.leaderboard || []);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();

    const intervalId = window.setInterval(() => {
      void loadLeaderboard({ silent: true });
    }, LEADERBOARD_REFRESH_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadLeaderboard({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loadLeaderboard]);

  const handleEntryClick = async (entry: LeaderboardEntry) => {
    setSelectedEntry(entry);
    setSheetLoading(true);
    setSheetPrediction(null);
    setSheetError(null);
    setSheetLockedMessage(null);
    setSheetOfficialGroups({});

    try {
      const res = await apiService.getUserTournamentPrediction(entry.userId);
      setSheetPrediction(res.data?.prediction ?? null);
      setSheetOfficialGroups(res.data?.officialGroupChampions ?? {});
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setSheetLockedMessage(
          'Tournament picks are hidden until the prediction deadline passes.'
        );
        return;
      }
      console.error('Failed to load user tournament prediction:', err);
      setSheetError('Failed to load tournament picks.');
    } finally {
      setSheetLoading(false);
    }
  };

  const closeSheet = () => {
    setSelectedEntry(null);
    setSheetPrediction(null);
    setSheetError(null);
    setSheetLockedMessage(null);
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
          <Leaderboard
            entries={leaderboard}
            title="Top 50 players"
            onEntryClick={handleEntryClick}
          />
        )}
      </div>

      {selectedEntry && (
        <TournamentPicksSheet
          name={selectedEntry.name}
          prediction={sheetPrediction}
          officialGroupChampions={sheetOfficialGroups}
          loading={sheetLoading}
          error={sheetError}
          lockedMessage={sheetLockedMessage}
          onClose={closeSheet}
        />
      )}
    </div>
  );
};

export default LeaderboardPage;
