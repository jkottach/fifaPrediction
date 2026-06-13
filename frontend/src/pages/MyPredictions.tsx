import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { Prediction, Match } from '../types';
import PredictionForm from '../components/PredictionForm';
import PageHero from '../components/PageHero';
import { btnPrimary, cardPad, spinner } from '../theme';
import { format } from 'date-fns';

const MyPredictions: React.FC = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [editingPrediction, setEditingPrediction] = useState<Prediction | null>(null);

  useEffect(() => {
    fetchPredictions(1);
  }, []);

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

  return (
    <div className="min-h-full bg-slate-50">
      <PageHero
        title="My predictions"
        subtitle="Points from completed matches"
        badge="Results"
      />

      <div className="px-5 py-6">
        {loading ? (
          <div className="flex flex-col items-center py-16">
            <div className={spinner} />
            <p className="mt-4 text-sm font-medium text-slate-600">Loading predictions...</p>
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

                return (
                  <article key={prediction.id ?? prediction._id} className={cardPad}>
                    <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="min-w-0 flex-1">
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
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
                        Done
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                        <p className="mb-1 text-[10px] font-semibold text-slate-500">Prediction</p>
                        <p className="font-mono text-lg font-bold text-slate-900">
                          {pred1 != null && pred2 != null ? `${pred1} - ${pred2}` : '—'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                        <p className="mb-1 text-[10px] font-semibold text-slate-500">Actual</p>
                        <p className="font-mono text-lg font-bold text-slate-700">
                          {isCompleted &&
                          typeof match === 'object' &&
                          match !== null
                            ? `${match.team1Score} - ${match.team2Score}`
                            : '—'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                        <p className="mb-1 text-[10px] font-bold text-emerald-700">Points</p>
                        <p className="font-display text-lg font-bold text-emerald-600">
                          {points != null ? points : '—'}
                        </p>
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
          <div className={`${cardPad} py-12 text-center`}>
            <p className="mb-4 text-sm font-medium text-slate-600">
              No completed match results yet. Your scored predictions appear here after matches finish.
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
