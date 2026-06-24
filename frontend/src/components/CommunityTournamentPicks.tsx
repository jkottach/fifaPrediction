import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { apiService } from '../services/apiService';
import {
  CommunityTournamentLockedResponse,
  CommunityTournamentPredictionsResponse,
} from '../types';
import { cardPad, spinner } from '../theme';
import TournamentConsensusPanel from './TournamentConsensusPanel';
import CommunityTournamentUserList, {
  CommunityTournamentSort,
} from './CommunityTournamentUserList';
import TournamentPicksLockedBanner from './TournamentPicksLockedBanner';

interface CommunityTournamentPicksProps {
  currentUserId?: string;
  onGoToMine?: () => void;
}

const CommunityTournamentPicks: React.FC<CommunityTournamentPicksProps> = ({
  currentUserId,
  onGoToMine,
}) => {
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState<CommunityTournamentLockedResponse | null>(null);
  const [data, setData] = useState<CommunityTournamentPredictionsResponse | null>(null);
  const [hasOwnSubmission, setHasOwnSubmission] = useState(false);
  const [sort, setSort] = useState<CommunityTournamentSort>('points');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [communityRes, ownRes] = await Promise.all([
        apiService.getCommunityTournamentPredictions(),
        apiService.getTournamentPrediction(),
      ]);

      setHasOwnSubmission(Boolean(ownRes.data?.prediction));
      setData(communityRes.data as CommunityTournamentPredictionsResponse);
      setLocked(null);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        const body = err.response.data as CommunityTournamentLockedResponse;
        setLocked(body);
        setData(null);

        try {
          const ownRes = await apiService.getTournamentPrediction();
          setHasOwnSubmission(Boolean(ownRes.data?.prediction));
        } catch {
          setHasOwnSubmission(false);
        }
        return;
      }

      console.error('Failed to load community tournament picks:', err);
      setError('Failed to load community tournament picks.');
      setLocked(null);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16">
        <div className={spinner} />
        <p className="mt-4 text-sm font-medium text-slate-600">Loading community picks…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardPad} py-10 text-center`}>
        <p className="text-sm font-medium text-slate-600">{error}</p>
      </div>
    );
  }

  if (locked) {
    return (
      <TournamentPicksLockedBanner
        unlocksAt={locked.unlocksAt}
        hasSubmitted={hasOwnSubmission}
        submittedCount={locked.submittedCount}
        onGoToMine={onGoToMine}
      />
    );
  }

  if (!data) {
    return (
      <div className={`${cardPad} py-10 text-center`}>
        <p className="text-sm font-medium text-slate-600">No community data available.</p>
      </div>
    );
  }

  const deadlineLabel = format(new Date(data.unlocksAt), 'MMM dd, yyyy');

  return (
    <div className="space-y-4">
      <div className={`${cardPad}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Community tournament picks
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-slate-900">
          {data.submittedCount} player{data.submittedCount === 1 ? '' : 's'} submitted
        </h2>
        <p className="mt-1 text-xs text-slate-500">Deadline was {deadlineLabel}</p>
      </div>

      <TournamentConsensusPanel consensus={data.consensus} submittedCount={data.submittedCount} />

      <div className="flex items-center justify-between gap-3 px-1">
        <h3 className="font-display text-base font-bold text-slate-900">All picks</h3>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as CommunityTournamentSort)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="points">Tournament points</option>
            <option value="name">Name</option>
            <option value="champion">Champion pick</option>
          </select>
        </label>
      </div>

      <CommunityTournamentUserList
        picks={data.picks}
        officialGroupChampions={data.officialGroupChampions}
        currentUserId={currentUserId}
        sort={sort}
      />
    </div>
  );
};

export default CommunityTournamentPicks;
