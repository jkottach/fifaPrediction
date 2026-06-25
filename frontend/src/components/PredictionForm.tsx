import React, { useEffect, useMemo, useState } from 'react';
import { Match, Prediction } from '../types';
import { apiService } from '../services/apiService';
import { needsPenaltyWinner } from '../utils/knockout';
import {
  GOAL_SCORE_MAX,
  GoalScoreInput,
  isValidGoalScore,
  normalizeGoalScore,
  parseGoalScoreInput,
} from '../utils/goalScore';
import PenaltyShootoutPicker from './PenaltyShootoutPicker';
import { alertError, btnOutline, btnPrimary, cardPad, input, label } from '../theme';

interface PredictionFormProps {
  match: Match;
  initialPrediction?: {
    team1Score: number;
    team2Score: number;
    comment?: string;
    penaltyWinner?: string | null;
  };
  onSuccess?: (prediction: Prediction) => void;
  onClose?: () => void;
}

const PredictionForm: React.FC<PredictionFormProps> = ({
  match,
  initialPrediction,
  onSuccess,
  onClose,
}) => {
  const [team1Score, setTeam1Score] = useState<GoalScoreInput>(
    initialPrediction ? normalizeGoalScore(initialPrediction.team1Score) : ''
  );
  const [team2Score, setTeam2Score] = useState<GoalScoreInput>(
    initialPrediction ? normalizeGoalScore(initialPrediction.team2Score) : ''
  );
  const [penaltyWinner, setPenaltyWinner] = useState<string | null>(
    initialPrediction?.penaltyWinner ?? null
  );
  const [comment, setComment] = useState(initialPrediction?.comment ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const showPenaltyPicker = useMemo(() => {
    if (!isValidGoalScore(team1Score) || !isValidGoalScore(team2Score)) return false;
    return needsPenaltyWinner(match, team1Score, team2Score);
  }, [match, team1Score, team2Score]);

  useEffect(() => {
    if (!showPenaltyPicker) setPenaltyWinner(null);
  }, [showPenaltyPicker]);

  const scoresValid = isValidGoalScore(team1Score) && isValidGoalScore(team2Score);
  const canSubmit = scoresValid && (!showPenaltyPicker || Boolean(penaltyWinner));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);

    try {
      const response = await apiService.submitPrediction({
        matchId: match.matchId,
        team1Score,
        team2Score,
        comment,
        ...(penaltyWinner ? { penaltyWinner } : {}),
      });

      if (onSuccess) {
        onSuccess(response.data.prediction);
      }

      if (onClose) {
        onClose();
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(message || 'Failed to submit prediction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${cardPad} w-full shadow-md`}>
      <h3 className="font-display text-lg font-bold text-slate-900 mb-4">
        Predict: {match.team1} vs {match.team2}
      </h3>

      {error && <div className={alertError}>{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={label}>{match.team1} Score</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            min="0"
            max={GOAL_SCORE_MAX}
            value={team1Score}
            onChange={(e) => setTeam1Score(parseGoalScoreInput(e.target.value))}
            className={input}
            autoComplete="off"
          />
        </div>

        <div>
          <label className={label}>{match.team2} Score</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            min="0"
            max={GOAL_SCORE_MAX}
            value={team2Score}
            onChange={(e) => setTeam2Score(parseGoalScoreInput(e.target.value))}
            className={input}
            autoComplete="off"
          />
        </div>

        {showPenaltyPicker && (
          <PenaltyShootoutPicker
            team1={{
              teamId: match.team1,
              teamName: match.team1Info?.teamName ?? match.team1,
              countryLogo: match.team1Info?.countryLogo,
            }}
            team2={{
              teamId: match.team2,
              teamName: match.team2Info?.teamName ?? match.team2,
              countryLogo: match.team2Info?.countryLogo,
            }}
            selectedTeamId={penaltyWinner}
            onSelect={setPenaltyWinner}
            disabled={loading}
            variant="light"
          />
        )}

        <div>
          <label className={label}>Comment (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={`${input} resize-none`}
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-2">
          <button type="submit" disabled={loading || !canSubmit} className={btnPrimary}>
            {loading ? 'Submitting...' : initialPrediction ? 'Update prediction' : 'Submit prediction'}
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className={btnOutline}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default PredictionForm;
