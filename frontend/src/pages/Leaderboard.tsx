import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { LeaderboardEntry, Prediction } from '../types';
import Leaderboard from '../components/Leaderboard';
import PageHero from '../components/PageHero';
import UserMatchPredictionsSheet from '../components/UserMatchPredictionsSheet';
import { spinner } from '../theme';

const LEADERBOARD_LIMIT = 50;
const PREDICTIONS_PAGE_SIZE = 10;

let cachedLeaderboard: LeaderboardEntry[] | null = null;
let leaderboardRequest: Promise<LeaderboardEntry[]> | null = null;

function fetchLeaderboardOnce(): Promise<LeaderboardEntry[]> {
  if (cachedLeaderboard) return Promise.resolve(cachedLeaderboard);

  if (!leaderboardRequest) {
    leaderboardRequest = apiService
      .getTopLeaderboard(LEADERBOARD_LIMIT)
      .then((res) => {
        const entries = res.data.leaderboard || [];
        cachedLeaderboard = entries;
        return entries;
      })
      .catch((error) => {
        leaderboardRequest = null;
        throw error;
      });
  }

  return leaderboardRequest;
}

const LeaderboardPage: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(
    () => cachedLeaderboard ?? []
  );
  const [loading, setLoading] = useState(() => cachedLeaderboard === null);
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetLoadingMore, setSheetLoadingMore] = useState(false);
  const [sheetPredictions, setSheetPredictions] = useState<Prediction[]>([]);
  const [sheetPagination, setSheetPagination] = useState({ page: 1, pages: 1 });
  const [sheetError, setSheetError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedLeaderboard) return;

    let cancelled = false;
    void fetchLeaderboardOnce()
      .then((entries) => {
        if (!cancelled) setLeaderboard(entries);
      })
      .catch((error) => {
        console.error('Failed to load leaderboard:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
        {loading && leaderboard.length === 0 ? (
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
