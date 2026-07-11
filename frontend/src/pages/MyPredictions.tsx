import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { Match, MatchEarnerEntry, MatchSlotEarners, Prediction } from '../types';
import PredictionForm from '../components/PredictionForm';
import PageHero from '../components/PageHero';
import TournamentPredictionHistoryCard from '../components/TournamentPredictionHistoryCard';
import CommunityTournamentPicks from '../components/CommunityTournamentPicks';
import { useAuth } from '../hooks/useAuth';
import { btnPrimary, cardPad, spinner } from '../theme';
import { format } from 'date-fns';
import { TournamentPrediction } from '../types';

type ViewMode = 'mine' | 'latest-top' | 'community';

const statCell =
  'rounded-lg border border-slate-100 bg-slate-50 px-1.5 py-2 text-center';
const statLabel =
  'mb-0.5 text-[9px] font-semibold leading-tight text-slate-500';
const statValue = 'font-display text-sm font-bold leading-tight text-slate-900 tabular-nums';
const statValueMono = `font-mono text-sm font-bold leading-tight text-slate-900 tabular-nums`;

const MyPredictions: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const initialView =
    (location.state as { view?: ViewMode } | null)?.view === 'community'
      ? 'community'
      : 'mine';
  const [view, setView] = useState<ViewMode>(initialView);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [editingPrediction, setEditingPrediction] = useState<Prediction | null>(null);
  const [matchSlots, setMatchSlots] = useState<MatchSlotEarners[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [topEarnersLoading, setTopEarnersLoading] = useState(false);
  const [tournamentPrediction, setTournamentPrediction] = useState<TournamentPrediction | null>(null);
  const [officialGroupChampions, setOfficialGroupChampions] = useState<Record<string, string>>({});
  const [officialSemifinalists, setOfficialSemifinalists] = useState<string[]>([]);
  const [officialFinalists, setOfficialFinalists] = useState<string[]>([]);
  const [officialChampion, setOfficialChampion] = useState('');
  const [tournamentLoading, setTournamentLoading] = useState(false);
  const [showTournamentCard, setShowTournamentCard] = useState(false);

  useEffect(() => {
    if (view === 'mine') {
      fetchPredictions(1);
      void fetchTournamentPrediction();
    }
  }, [view]);

  const fetchTournamentPrediction = async () => {
    try {
      setTournamentLoading(true);
      const response = await apiService.getTournamentPrediction();
      setTournamentPrediction(response.data?.prediction ?? null);
      setOfficialGroupChampions(response.data?.officialGroupChampions ?? {});
      setOfficialSemifinalists(response.data?.officialSemifinalists ?? []);
      setOfficialFinalists(response.data?.officialFinalists ?? []);
      setOfficialChampion(response.data?.officialChampion ?? '');
    } catch (error) {
      console.error('Failed to fetch tournament prediction:', error);
      setTournamentPrediction(null);
      setOfficialGroupChampions({});
      setOfficialSemifinalists([]);
      setOfficialFinalists([]);
      setOfficialChampion('');
    } finally {
      setTournamentLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'latest-top') {
      fetchLatestTopEarners();
    }
  }, [view]);

  useEffect(() => {
    setSelectedSlotIndex(0);
  }, [matchSlots]);

  const fetchPredictions = async (page: number) => {
    try {
      setLoading(true);
      const response = await apiService.getUserPredictionsFromResults(page, 10);
      setPredictions(response.data.predictions);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestTopEarners = async () => {
    try {
      setTopEarnersLoading(true);
      const response = await apiService.getLatestCompletedMatchTopEarners(50);
      setMatchSlots(response.data.matchSlots ?? []);
    } catch (error) {
      console.error('Failed to fetch latest match top earners:', error);
      setMatchSlots([]);
    } finally {
      setTopEarnersLoading(false);
    }
  };

  const handleEditSuccess = () => {
    setEditingPrediction(null);
    fetchPredictions(pagination.page);
  };

  const getPoints = (prediction: Prediction & { matchPoints?: number }): number | null => {
    if (prediction.matchPoints != null) return prediction.matchPoints;
    if (prediction.points != null) return prediction.points;
    const match = prediction.matchId;
    const isCompleted =
      typeof match === 'object' &&
      match !== null &&
      (match as Match).status === 'completed';
    return isCompleted ? 0 : null;
  };

  const medal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const matchTeamName = (match: Match, side: 1 | 2) =>
    side === 1
      ? match.team1Info?.teamName ?? match.team1 ?? 'Team 1'
      : match.team2Info?.teamName ?? match.team2 ?? 'Team 2';

  const renderEarnersList = (earners: MatchEarnerEntry[]) =>
    earners.length > 0 ? (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {earners.map((entry) => (
            <div
              key={entry.userId}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${
                entry.rank <= 3 ? 'bg-emerald-50/60' : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-10 shrink-0 font-display font-bold text-slate-900">
                  {medal(entry.rank) || `#${entry.rank}`}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{entry.name}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    Predicted {entry.team1Score} – {entry.team2Score}
                  </p>
                </div>
              </div>
              <span className="shrink-0 font-display text-lg font-bold text-emerald-600">
                {entry.points} pts
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className={`${cardPad} py-10 text-center`}>
        <p className="text-sm font-medium text-slate-600">
          No predictions were submitted for this match.
        </p>
      </div>
    );

  const matchSlotKey = (slot: MatchSlotEarners, index: number) =>
    slot.match._id ?? slot.match.matchId ?? slot.match.matchTag ?? String(index);

  const renderMatchSlotTile = (slot: MatchSlotEarners, index: number, isSelected: boolean) => {
    const match = slot.match;
    return (
      <button
        key={matchSlotKey(slot, index)}
        type="button"
        onClick={() => setSelectedSlotIndex(index)}
        aria-pressed={isSelected}
        className={`p-4 text-left transition ${
          isSelected
            ? 'bg-slate-900 text-white'
            : 'bg-white text-slate-900 hover:bg-slate-50'
        }`}
      >
        <p
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            isSelected ? 'text-white/60' : 'text-slate-400'
          }`}
        >
          {match.matchTag || 'Match'}
        </p>
        <h2 className="mt-1 font-display text-sm font-bold leading-snug sm:text-base">
          {matchTeamName(match, 1)} vs {matchTeamName(match, 2)}
        </h2>
        <p className={`mt-1 text-xs ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>
          Final: {match.team1Score} – {match.team2Score}
        </p>
      </button>
    );
  };

  return (
    <div className="min-h-full bg-slate-50">
      <PageHero
        title="My predictions"
        subtitle={
          view === 'mine'
            ? 'Completed matches and points earned'
            : view === 'latest-top'
              ? 'Rankings from the last finished match(es)'
              : 'See how everyone picked the tournament'
        }
        badge="History"
      />

      <div className="px-5 py-6">
        <div className="mb-5 flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setView('mine')}
            className={`flex-1 rounded-lg px-2 py-2.5 text-xs sm:text-sm font-semibold transition ${
              view === 'mine'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            My predictions
          </button>
          <button
            type="button"
            onClick={() => setView('latest-top')}
            className={`flex-1 rounded-lg px-2 py-2.5 text-xs sm:text-sm font-semibold transition ${
              view === 'latest-top'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Last match rank
          </button>
          <button
            type="button"
            onClick={() => setView('community')}
            className={`flex-1 rounded-lg px-2 py-2.5 text-xs sm:text-sm font-semibold transition ${
              view === 'community'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Tournament picks
          </button>
        </div>

        {view === 'community' ? (
          <CommunityTournamentPicks
            currentUserId={user?.userId}
            onGoToMine={() => setView('mine')}
          />
        ) : view === 'latest-top' ? (
          topEarnersLoading ? (
            <div className="flex flex-col items-center py-16">
              <div className={spinner} />
              <p className="mt-4 text-sm font-medium text-slate-600">Loading...</p>
            </div>
          ) : matchSlots.length === 0 ? (
            <div className={`${cardPad} py-12 text-center`}>
              <p className="text-sm font-medium text-slate-600">No finished matches yet.</p>
            </div>
          ) : matchSlots.length === 1 ? (
            <>
              <div className={`${cardPad} mb-4`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {matchSlots[0].match.matchTag || 'Latest completed match'}
                </p>
                <h2 className="mt-1 font-display text-lg font-bold text-slate-900">
                  {matchTeamName(matchSlots[0].match, 1)} vs {matchTeamName(matchSlots[0].match, 2)}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Final: {matchSlots[0].match.team1Score} – {matchSlots[0].match.team2Score}
                  {matchSlots[0].match.matchTime
                    ? ` · ${format(new Date(matchSlots[0].match.matchTime), 'MMM dd, yyyy · HH:mm')}`
                    : ''}
                </p>
              </div>
              {renderEarnersList(matchSlots[0].earners)}
            </>
          ) : (
            <>
              <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="grid grid-cols-2 divide-x divide-slate-100">
                  {matchSlots.map((slot, index) =>
                    renderMatchSlotTile(slot, index, selectedSlotIndex === index)
                  )}
                </div>
              </div>

              <p className="mb-3 text-xs text-slate-500">
                {matchSlots[selectedSlotIndex].match.matchTime
                  ? format(
                      new Date(matchSlots[selectedSlotIndex].match.matchTime),
                      'MMM dd, yyyy · HH:mm'
                    )
                  : null}
              </p>
              {renderEarnersList(matchSlots[selectedSlotIndex].earners)}
            </>
          )
        ) : loading && !tournamentPrediction ? (
          <div className="flex flex-col items-center py-16">
            <div className={spinner} />
            <p className="mt-4 text-sm font-medium text-slate-600">Loading predictions...</p>
          </div>
        ) : predictions.length > 0 || tournamentPrediction ? (
          <>
            {tournamentPrediction && (
              <div className="mb-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Tournament Picks
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowTournamentCard((open) => !open)}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition"
                    aria-expanded={showTournamentCard}
                  >
                    {showTournamentCard ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showTournamentCard && (
                  <TournamentPredictionHistoryCard
                    prediction={tournamentPrediction}
                    officialGroupChampions={officialGroupChampions}
                    officialSemifinalists={officialSemifinalists}
                    officialFinalists={officialFinalists}
                    officialChampion={officialChampion}
                  />
                )}
              </div>
            )}

            {loading && predictions.length === 0 && !tournamentLoading ? (
              <div className="flex flex-col items-center py-8">
                <div className={spinner} />
              </div>
            ) : predictions.length > 0 ? (
            <>
            <div className="space-y-3">
              {predictions.map((prediction: Prediction & {
                id?: string;
                team1PredictedScore?: number;
                team2PredictedScore?: number;
              }) => {
                const match = prediction.matchId;
                const team1Name =
                  typeof match === 'object' && match !== null
                    ? match.team1Info?.teamName || match.team1
                    : 'Unknown';
                const team2Name =
                  typeof match === 'object' && match !== null
                    ? match.team2Info?.teamName || match.team2
                    : 'Unknown';
                const isCompleted =
                  typeof match === 'object' && match !== null && match.status === 'completed';
                const pred1 = prediction.team1PredictedScore ?? prediction.team1Score;
                const pred2 = prediction.team2PredictedScore ?? prediction.team2Score;
                const points = getPoints(prediction);
                const rank = prediction.overallRank;
                const previousRank = prediction.previousOverallRank;
                const rankTrend =
                  rank != null && previousRank != null && rank !== previousRank
                    ? rank < previousRank
                      ? 'up'
                      : 'down'
                    : null;

                return (
                  <article key={prediction.id ?? prediction._id} className={cardPad}>
                    <div className="mb-4 border-b border-slate-100 pb-4">
                      <h3 className="font-display text-[15px] font-bold text-slate-900">
                        {team1Name} vs {team2Name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {typeof match === 'object' &&
                        match !== null &&
                        match.matchTime
                          ? format(new Date(match.matchTime), 'MMM dd, yyyy · HH:mm')
                          : '—'}
                      </p>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      <div className={statCell}>
                        <p className={statLabel}>Prediction</p>
                        <p className={statValueMono}>
                          {pred1 != null && pred2 != null ? `${pred1} - ${pred2}` : '—'}
                        </p>
                      </div>
                      <div className={statCell}>
                        <p className={statLabel}>Actual</p>
                        <p className={`${statValueMono} text-slate-700`}>
                          {isCompleted &&
                          typeof match === 'object' &&
                          match !== null
                            ? `${match.team1Score} - ${match.team2Score}`
                            : '—'}
                        </p>
                      </div>
                      <div className={statCell}>
                        <p className={statLabel}>Points</p>
                        <p className={statValue}>{points != null ? points : '—'}</p>
                      </div>
                      <div className={statCell}>
                        <p className={statLabel}>Total pts</p>
                        <p className={statValue}>
                          {prediction.totalPoints != null ? prediction.totalPoints : '—'}
                        </p>
                      </div>
                      <div className={statCell}>
                        <p className={statLabel}>Rank</p>
                        <div className={`flex items-center justify-center gap-0.5 ${statValue}`}>
                          {rankTrend === 'up' ? (
                            <span className="text-emerald-600" aria-label="Rank improved">
                              ↑
                            </span>
                          ) : rankTrend === 'down' ? (
                            <span className="text-red-500" aria-label="Rank dropped">
                              ↓
                            </span>
                          ) : null}
                          <span>{rank != null ? rank : '—'}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {pagination.pages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  disabled={pagination.page === 1}
                  onClick={() => fetchPredictions(pagination.page - 1)}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  ← Prev
                </button>
                <span className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">
                  {pagination.page} / {pagination.pages}
                </span>
                <button
                  disabled={pagination.page === pagination.pages}
                  onClick={() => fetchPredictions(pagination.page + 1)}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            )}
            </>
            ) : (
              <div className={`${cardPad} py-8 text-center`}>
                <p className="text-sm font-medium text-slate-600">
                  No completed match predictions yet. Finished matches will appear here once results are in.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className={`${cardPad} py-12 text-center`}>
            <p className="mb-4 text-sm font-medium text-slate-600">
              No completed predictions yet. Finished matches will appear here once results are in.
            </p>
            <Link to="/dashboard" className={`${btnPrimary} inline-flex max-w-xs mx-auto`}>
              Start predicting
            </Link>
          </div>
        )}
      </div>

      {editingPrediction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <PredictionForm
            match={editingPrediction.matchId as Match}
            initialPrediction={{
              team1Score: editingPrediction.team1Score,
              team2Score: editingPrediction.team2Score,
              comment: editingPrediction.comment,
              penaltyWinner: editingPrediction.penaltyWinner,
            }}
            onSuccess={handleEditSuccess}
            onClose={() => setEditingPrediction(null)}
          />
        </div>
      )}
    </div>
  );
};

export default MyPredictions;
