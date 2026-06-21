import React, { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import {
  allTournamentTeams,
  emptyGroupChampions,
  TOURNAMENT_GROUPS,
} from '../constants/tournamentTeams';
import { GroupStageGroupInfo, Team, TournamentPrediction } from '../types';
import {
  predictionCardBg,
  predictionCardLabel,
  predictionCardPitchStyle,
  predictionCardSelect,
  predictionCardShell,
} from '../theme';

const EMPTY_FINALISTS: [string, string] = ['', ''];
const EMPTY_SEMIS: [string, string, string, string] = ['', '', '', ''];

function groupChampionsFromPrediction(
  pred: TournamentPrediction | null,
  groups: GroupStageGroupInfo[]
): Record<string, string> {
  const picks: Record<string, string> = {};
  for (const g of groups) {
    picks[g.group] = '';
  }
  if (!pred?.groupChampions) return picks;
  for (const row of pred.groupChampions) {
    picks[row.group] = row.teamId;
  }
  return picks;
}

function picksFromPrediction(
  pred: TournamentPrediction | null,
  groups: GroupStageGroupInfo[]
): {
  champion: string;
  finalists: [string, string];
  semifinalists: [string, string, string, string];
  groupChampions: Record<string, string>;
} {
  if (!pred) {
    return {
      champion: '',
      finalists: [...EMPTY_FINALISTS],
      semifinalists: [...EMPTY_SEMIS],
      groupChampions: groupChampionsFromPrediction(null, groups),
    };
  }
  return {
    champion: pred.champion?.teamId ?? '',
    finalists: [
      pred.finalists[0]?.teamId ?? '',
      pred.finalists[1]?.teamId ?? '',
    ] as [string, string],
    semifinalists: [
      pred.semifinalists[0]?.teamId ?? '',
      pred.semifinalists[1]?.teamId ?? '',
      pred.semifinalists[2]?.teamId ?? '',
      pred.semifinalists[3]?.teamId ?? '',
    ] as [string, string, string, string],
    groupChampions: groupChampionsFromPrediction(pred, groups),
  };
}

function uniqueCount(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

function groupPickResult(
  group: string,
  predicted: string,
  officialGroupChampions: Record<string, string>
): 'correct' | 'wrong' | null {
  const official = officialGroupChampions[group];
  if (!official || !predicted) return null;
  return predicted.toUpperCase() === official.toUpperCase() ? 'correct' : 'wrong';
}

function groupPickSelectClass(result: 'correct' | 'wrong' | null): string {
  if (result === 'correct') {
    return '!border-2 !border-emerald-400 focus:!border-emerald-400 focus:ring-emerald-400/70 shadow-sm shadow-emerald-500/30';
  }
  if (result === 'wrong') {
    return '!border-2 !border-red-400 focus:!border-red-400 focus:ring-red-400/70 shadow-sm shadow-red-500/30';
  }
  return '';
}

function validateGroupPicks(
  groupChampions: Record<string, string>,
  groups: GroupStageGroupInfo[]
): string | null {
  for (const { group, teams } of groups) {
    const pick = groupChampions[group];
    if (!pick) {
      return `Pick a winner for Group ${group}`;
    }
    if (!teams.some((t) => t.teamId === pick)) {
      return `Invalid pick for Group ${group}`;
    }
  }
  return null;
}

function validatePicks(
  champion: string,
  finalists: [string, string],
  semifinalists: [string, string, string, string],
  groupChampions: Record<string, string>,
  groups: GroupStageGroupInfo[]
): string | null {
  const groupError = validateGroupPicks(groupChampions, groups);
  if (groupError) return groupError;

  if (!champion || finalists.some((f) => !f) || semifinalists.some((s) => !s)) {
    return 'Pick a champion, two finalists, and four semifinalists';
  }
  if (!uniqueCount(semifinalists)) {
    return 'Each semifinalist must be a different team';
  }
  if (!uniqueCount(finalists)) {
    return 'Your two finalists must be different teams';
  }
  if (!finalists.includes(champion)) {
    return 'Champion must be one of your two finalist picks';
  }
  for (const f of finalists) {
    if (!semifinalists.includes(f)) {
      return 'Both finalists must be chosen from your four semifinalist picks';
    }
  }
  return null;
}

interface TeamSelectProps {
  id: string;
  value: string;
  onChange: (teamId: string) => void;
  teams: Team[];
  disabled: boolean;
  placeholder: string;
  excludeIds?: string[];
}

const TeamSelect: React.FC<TeamSelectProps> = ({
  id,
  value,
  onChange,
  teams,
  disabled,
  placeholder,
  excludeIds = [],
}) => (
  <select
    id={id}
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    className={predictionCardSelect}
  >
    <option value="" className="text-slate-900">
      {placeholder}
    </option>
    {teams.map((t) => (
      <option
        key={t.teamId}
        value={t.teamId}
        disabled={excludeIds.includes(t.teamId) && t.teamId !== value}
        className="text-slate-900"
      >
        {t.teamName}
      </option>
    ))}
  </select>
);

interface PredictionCardShellProps {
  children: React.ReactNode;
  className?: string;
}

const PredictionCardShell: React.FC<PredictionCardShellProps> = ({ children, className = '' }) => (
  <div className={`${predictionCardShell} ${className}`} style={predictionCardBg}>
    <div
      className="absolute inset-0 opacity-[0.04] pointer-events-none"
      style={predictionCardPitchStyle}
    />
    <div className="relative z-10">{children}</div>
  </div>
);

const HARDCODED_GROUPS = TOURNAMENT_GROUPS;
const HARDCODED_TEAMS = allTournamentTeams();

const TournamentPredictions: React.FC = () => {
  const teams = HARDCODED_TEAMS;
  const groups = HARDCODED_GROUPS;
  const [groupChampions, setGroupChampions] = useState<Record<string, string>>(emptyGroupChampions);
  const [saved, setSaved] = useState<TournamentPrediction | null>(null);
  const [officialGroupChampions, setOfficialGroupChampions] = useState<Record<string, string>>({});
  const [champion, setChampion] = useState('');
  const [finalists, setFinalists] = useState<[string, string]>([...EMPTY_FINALISTS]);
  const [semifinalists, setSemifinalists] = useState<[string, string, string, string]>([...EMPTY_SEMIS]);
  const [isOpen, setIsOpen] = useState(true);
  const [loadingPrediction, setLoadingPrediction] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSavedPrediction = async () => {
      setLoadingPrediction(true);
      try {
        const predRes = await apiService.getTournamentPrediction();
        if (cancelled) return;

        const pred: TournamentPrediction | null = predRes.data?.prediction ?? null;
        setSaved(pred);
        setOfficialGroupChampions(predRes.data?.officialGroupChampions ?? {});
        setIsOpen(predRes.data?.isOpen !== false);

        const picks = picksFromPrediction(pred, groups);
        setChampion(picks.champion);
        setFinalists(picks.finalists);
        setSemifinalists(picks.semifinalists);
        setGroupChampions(picks.groupChampions);
      } catch (predErr: unknown) {
        if (!cancelled) {
          console.error('Failed to load saved tournament prediction:', predErr);
        }
      } finally {
        if (!cancelled) setLoadingPrediction(false);
      }
    };

    void loadSavedPrediction();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    const validationError = validatePicks(
      champion,
      finalists,
      semifinalists,
      groupChampions,
      groups
    );
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!isOpen) {
      setError('Tournament predictions are closed');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await apiService.submitTournamentPrediction({
        champion,
        finalists: finalists as [string, string],
        semifinalists: semifinalists as [string, string, string, string],
        groupChampions: groups.length > 0 ? groupChampions : undefined,
      });

      const teamsById = new Map(teams.map((t) => [t.teamId, t]));
      const enrich = (teamId: string) => ({
        teamId,
        teamName: teamsById.get(teamId)?.teamName ?? teamId,
        countryLogo: teamsById.get(teamId)?.countryLogo ?? null,
      });

      const enrichFromGroups = (teamId: string, groupTeams: GroupStageGroupInfo['teams']) => {
        const fromGroup = groupTeams.find((t) => t.teamId === teamId);
        return {
          teamId,
          teamName: fromGroup?.teamName ?? teamsById.get(teamId)?.teamName ?? teamId,
          countryLogo: fromGroup?.countryLogo ?? teamsById.get(teamId)?.countryLogo ?? null,
        };
      };

      setSaved({
        champion: enrich(champion),
        finalists: finalists.map(enrich),
        semifinalists: semifinalists.map(enrich),
        groupChampions: groups.map(({ group, teams: groupTeams }) => ({
          group,
          ...enrichFromGroups(groupChampions[group], groupTeams),
        })),
        points: saved?.points ?? 0,
        submittedTime: saved?.submittedTime ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to save tournament prediction';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const updateFinalist = (index: 0 | 1, teamId: string) => {
    setFinalists((prev) => {
      const next: [string, string] = [...prev];
      next[index] = teamId;
      return next;
    });
  };

  const updateSemifinalist = (index: number, teamId: string) => {
    setSemifinalists((prev) => {
      const next: [string, string, string, string] = [...prev];
      next[index] = teamId;
      return next;
    });
  };

  const updateGroupChampion = (group: string, teamId: string) => {
    setGroupChampions((prev) => ({ ...prev, [group]: teamId }));
  };

  const statusBadge = isOpen ? (
    <span className="px-2 py-0.5 rounded-full bg-emerald-500/70 text-[10px] font-bold text-white">
      Open
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded-full bg-gray-500/70 text-[10px] font-bold text-white">
      Closed
    </span>
  );

  return (
    <PredictionCardShell>
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">
          Tournament picks
        </span>
        {statusBadge}
      </div>

      {loadingPrediction && (
        <p className="px-4 pb-2 text-white/40 text-[10px] uppercase tracking-wider">
          Loading your saved picks…
        </p>
      )}

      {saved && !loadingPrediction && (
        <div className="mx-4 mb-3 flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Tournament total points
          </p>
          <p className="font-display text-3xl font-bold tabular-nums text-emerald-400">
            {saved.points ?? 0}
          </p>
        </div>
      )}

      {error && (
        <p className="relative z-10 text-red-400 text-[11px] text-center px-4 mb-2 font-medium">
          {error}
        </p>
      )}

      <div className="mx-4 border-t border-white/[0.08]" />

      <div className="px-4 py-4 space-y-4">
        <div>
            <p className={predictionCardLabel}>Group champions (winner of each group)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {groups.map(({ group, teams: groupTeams }) => {
                const pickResult = groupPickResult(
                  group,
                  groupChampions[group] ?? '',
                  officialGroupChampions
                );
                return (
                  <div key={group}>
                    <label
                      className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1"
                      htmlFor={`group-champion-${group}`}
                    >
                      Group {group}
                    </label>
                    <select
                      id={`group-champion-${group}`}
                      value={groupChampions[group] ?? ''}
                      disabled={!isOpen || submitting}
                      onChange={(e) => updateGroupChampion(group, e.target.value)}
                      className={`${predictionCardSelect} ${groupPickSelectClass(pickResult)}`}
                    >
                        <option value="" className="text-slate-900" />
                        {groupTeams.map((t) => (
                          <option key={t.teamId} value={t.teamId} className="text-slate-900">
                            {t.teamName}
                          </option>
                        ))}
                      </select>
                  </div>
                );
              })}
            </div>
          </div>

        <div className="border-t border-white/[0.08] pt-2" />

        <div>
          <p className={predictionCardLabel}>Knockout — semifinalists (4 teams)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([0, 1, 2, 3] as const).map((i) => (
              <TeamSelect
                key={`semi-${i}`}
                id={`tournament-semi-${i}`}
                value={semifinalists[i]}
                onChange={(id) => updateSemifinalist(i, id)}
                teams={teams}
                disabled={!isOpen || submitting}
                placeholder={`Semifinalist ${i + 1}`}
                excludeIds={[
                  champion,
                  ...finalists,
                  ...semifinalists.filter((_, idx) => idx !== i),
                ].filter((id): id is string => Boolean(id))}
              />
            ))}
          </div>
        </div>

        <div>
          <p className={predictionCardLabel}>Finalists (2 teams)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([0, 1] as const).map((i) => {
              const semiPool = semifinalists.filter(Boolean);
              const allSemisPicked = semiPool.length === 4;
              const finalistTeams = allSemisPicked
                ? teams.filter((t) => semiPool.includes(t.teamId))
                : teams;
              const otherFinalist = finalists[i === 0 ? 1 : 0];
              return (
                <TeamSelect
                  key={`finalist-${i}`}
                  id={`tournament-finalist-${i}`}
                  value={finalists[i]}
                  onChange={(id) => updateFinalist(i, id)}
                  teams={finalistTeams}
                  disabled={!isOpen || submitting || !allSemisPicked}
                  placeholder={allSemisPicked ? `Finalist ${i + 1}` : 'Pick 4 semifinalists first'}
                  excludeIds={[otherFinalist].filter((id): id is string => Boolean(id))}
                />
              );
            })}
          </div>
        </div>

        <div>
          <label className={predictionCardLabel} htmlFor="tournament-champion">
            Champion (winner)
          </label>
          <TeamSelect
            id="tournament-champion"
            value={champion}
            onChange={setChampion}
            teams={
              finalists.every(Boolean)
                ? teams.filter((t) => finalists.includes(t.teamId))
                : teams
            }
            disabled={!isOpen || submitting || !finalists.every(Boolean)}
            placeholder={
              finalists.every(Boolean) ? 'Select champion' : 'Pick both finalists first'
            }
            excludeIds={[]}
          />
        </div>
      </div>

      <div className="mx-4 border-t border-white/[0.08]" />

      <div className="px-4 py-4">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || !isOpen}
          className={`w-full py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 ${
            success
              ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
              : isOpen
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98] shadow-lg shadow-emerald-500/30 disabled:opacity-50'
                : 'bg-white/8 text-white/25 cursor-not-allowed border border-white/10'
          }`}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving…
            </span>
          ) : success ? (
            '✓ Prediction Saved!'
          ) : isOpen ? (
            saved ? 'Update Prediction' : 'Submit Prediction'
          ) : (
            'Prediction Closed'
          )}
        </button>
      </div>
    </PredictionCardShell>
  );
};

export default TournamentPredictions;
