import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { LeaderboardEntry, Prediction } from '../types';
import Leaderboard from '../components/Leaderboard';
import PageHero from '../components/PageHero';
import UserMatchPredictionsSheet from '../components/UserMatchPredictionsSheet';
import { spinner } from '../theme';

const LEADERBOARD_LIMIT = 50;
const PREDICTIONS_PAGE_SIZE = 10;

const LeaderboardPage: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetLoadingMore, setSheetLoadingMore] = useState(false);
  const [sheetPredictions, setSheetPredictions] = useState<Prediction[]>([]);
  const [sheetPagination, setSheetPagination] = useState({ page: 1, pages: 1 });
  const [sheetError, setSheetError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiService.getTopLeaderboard(LEADERBOARD_LIMIT);
      setLeaderboard(res.data.leaderboard || []);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadLeaderboard();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadLeaderboard]);

  const fetchUserPredictions = async (userId: string, page: number, append: boolean) => {
    const res = await apiService.getUserPredictionsFromResultsByUserId(
      userId,
      page,
      PREDICTIONS_PAGE_SIZE
    );
    const nextPredictions = res.data.predictions ?? [];
    setSheetPredictions((current) => (append ? [...current, ...nextPredictions] : nextPredictions));
    setSheetPagination({
      page: res.data.pagination?.page ?? page,
      pages: res.data.pagination?.pages ?? 1,
    });
  };

  const handleEntryClick = async (entry: LeaderboardEntry) => {
    setSelectedEntry(entry);
    setSheetLoading(true);
    setSheetPredictions([]);
    setSheetError(null);
    setSheetPagination({ page: 1, pages: 1 });

    try {
      await fetchUserPredictions(entry.userId, 1, false);
    } catch (err) {
      console.error('Failed to load user match predictions:', err);
      setSheetError('Failed to load predictions.');
    } finally {
      setSheetLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!selectedEntry || sheetLoadingMore || sheetPagination.page >= sheetPagination.pages) {
      return;
    }

    try {
      setSheetLoadingMore(true);
      await fetchUserPredictions(selectedEntry.userId, sheetPagination.page + 1, true);
    } catch (err) {
      console.error('Failed to load more predictions:', err);
      setSheetError('Failed to load more predictions.');
    } finally {
      setSheetLoadingMore(false);
    }
  };

  const closeSheet = () => {
    setSelectedEntry(null);
    setSheetPredictions([]);
    setSheetError(null);
    setSheetPagination({ page: 1, pages: 1 });
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
        <UserMatchPredictionsSheet
          name={selectedEntry.name}
          predictions={sheetPredictions}
          loading={sheetLoading}
          error={sheetError}
          hasMore={sheetPagination.page < sheetPagination.pages}
          loadingMore={sheetLoadingMore}
          onLoadMore={handleLoadMore}
          onClose={closeSheet}
        />
      )}
    </div>
  );
};

export default LeaderboardPage;
