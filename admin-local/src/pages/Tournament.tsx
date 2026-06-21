import React, { useCallback, useEffect, useState } from 'react';
import TeamSelect from '../components/TeamSelect';
import { applyGroupChampion, applyTournamentResults, getTournamentSetup } from '../api';
import { TOURNAMENT_POINTS } from '../constants/tournamentPoints';
import type { GroupStageGroupInfo, TournamentOfficialResults, TournamentTeamOption } from '../types';

const EMPTY_FINALISTS: [string, string] = ['', ''];
const EMPTY_SEMIS: [string, string, string, string] = ['', '', '', ''];

interface TournamentProps {
  selectedTenantId: string;
  isAllTenants: boolean;
  activeTenantLabel?: string;
}

function allTeamsFromGroups(groups: GroupStageGroupInfo[]): TournamentTeamOption[] {
  const byId = new Map<string, TournamentTeamOption>();
  for (const g of groups) {
    for (const t of g.teams) {
      byId.set(t.teamId, t);
    }
  }
  return [...byId.values()].sort((a, b) => a.teamName.localeCompare(b.teamName));
}

const Tournament: React.FC<TournamentProps> = ({
  selectedTenantId,
  isAllTenants,
  activeTenantLabel,
}) => {
  const [groups, setGroups] = useState<GroupStageGroupInfo[]>([]);
  const [teams, setTeams] = useState<TournamentTeamOption[]>([]);
  const [predictionsCount, setPredictionsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedGroupChampions, setSavedGroupChampions] = useState<Record<string, string>>({});

  const [champion, setChampion] = useState('');
  const [finalists, setFinalists] = useState<[string, string]>([...EMPTY_FINALISTS]);
  const [semifinalists, setSemifinalists] = useState<[string, string, string, string]>([
    ...EMPTY_SEMIS,
  ]);
  const [groupChampions, setGroupChampions] = useState<Record<string, string>>({});

  const applyResultsToForm = useCallback(
    (results: TournamentOfficialResults | null, stageGroups: GroupStageGroupInfo[]) => {
      const emptyGroups: Record<string, string> = {};
      for (const g of stageGroups) emptyGroups[g.group] = '';

      if (!results) {
        setChampion('');
        setFinalists([...EMPTY_FINALISTS]);
        setSemifinalists([...EMPTY_SEMIS]);
        setGroupChampions(emptyGroups);
        setSavedGroupChampions({});
        return;
      }

      setChampion(results.champion ?? '');
      setFinalists([
        results.finalists[0] ?? '',
        results.finalists[1] ?? '',
      ]);
      setSemifinalists([
        results.semifinalists[0] ?? '',
        results.semifinalists[1] ?? '',
        results.semifinalists[2] ?? '',
        results.semifinalists[3] ?? '',
      ]);
      const mergedGroups = { ...emptyGroups, ...results.groupChampions };
      setGroupChampions(mergedGroups);
      setSavedGroupChampions({ ...results.groupChampions });
    },
    []
  );

  const loadSetup = useCallback(async () => {
    if (!selectedTenantId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getTournamentSetup();
      setGroups(data.groups);
      setTeams(allTeamsFromGroups(data.groups));
      setPredictionsCount(data.predictionsCount);
      applyResultsToForm(data.results, data.groups);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(message || 'Failed to load tournament data');
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId, applyResultsToForm]);

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  const handleSaveGroup = async (group: string) => {
    const teamId = groupChampions[group]?.trim();
    if (!teamId) {
      setError(`Pick a winner for Group ${group} first`);
      return;
    }

    setError('');
    setSuccess('');
    setSavingGroup(group);
    try {
      const { message, outcomes } = await applyGroupChampion(group, teamId);
      const failed = outcomes?.filter((o) => !o.ok) ?? [];
      if (failed.length > 0) {
        setSuccess(
          `${message}. Failed: ${failed.map((f) => f.tenant.label).join(', ')}`
        );
      } else {
        setSuccess(message);
      }
      setSavedGroupChampions((prev) => ({ ...prev, [group]: teamId }));
      void loadSetup();
      setTimeout(() => setSuccess(''), 6000);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(message || `Failed to save Group ${group} winner`);
    } finally {
      setSavingGroup(null);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const body: TournamentOfficialResults = {
        champion,
        finalists,
        semifinalists,
        groupChampions,
      };
      const { message, outcomes } = await applyTournamentResults(body);
      const failed = outcomes?.filter((o) => !o.ok) ?? [];
      if (failed.length > 0) {
        setSuccess(
          `${message}. Failed: ${failed.map((f) => f.tenant.label).join(', ')}`
        );
      } else {
        setSuccess(message);
      }
      void loadSetup();
      setTimeout(() => setSuccess(''), 6000);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(message || 'Failed to apply tournament scoring');
    } finally {
      setSubmitting(false);
    }
  };

  const semiPool = semifinalists.filter(Boolean);
  const allSemisPicked = semiPool.length === 4;
  const finalistTeams = allSemisPicked ? teams.filter((t) => semiPool.includes(t.teamId)) : teams;
  const championTeams = finalists.every(Boolean)
    ? teams.filter((t) => finalists.includes(t.teamId))
    : teams;

  return (
    <div className="px-5 py-4 max-w-lg mx-auto pb-10">
      {activeTenantLabel && (
        <p className="mb-3 text-xs text-slate-500 text-center">
          Scoring for{' '}
          <span className="font-semibold text-slate-700">{activeTenantLabel}</span>
          {isAllTenants && (
            <span className="text-slate-400"> · group list preview from default app</span>
          )}
        </p>
      )}

      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-600">
        <p className="font-semibold text-slate-900 mb-2">Points per correct pick</p>
        <ul className="grid grid-cols-2 gap-1 text-xs">
          <li>Group winner: +{TOURNAMENT_POINTS.groupChampion}</li>
          <li>Semifinalist: +{TOURNAMENT_POINTS.semifinalist}</li>
          <li>Finalist: +{TOURNAMENT_POINTS.finalist}</li>
          <li>Champion: +{TOURNAMENT_POINTS.champion}</li>
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          {predictionsCount} user(s) with a tournament prediction in this database.
          Leaderboard totals = match points + tournament points.
        </p>
      </section>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-slate-600 py-12">Loading tournament data…</p>
      ) : groups.length === 0 ? (
        <p className="text-center text-sm text-slate-600 py-12">
          No group-stage matches in this database. Seed matches with groups first.
        </p>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-sm font-bold text-slate-900">Group stage winners</h2>
              <p className="text-[10px] text-slate-500">Save one group at a time</p>
            </div>
            <div className="space-y-3">
              {groups.map((g) => {
                const pick = groupChampions[g.group] ?? '';
                const isSaved = Boolean(pick) && savedGroupChampions[g.group] === pick;
                const isSaving = savingGroup === g.group;

                return (
                  <div
                    key={g.group}
                    className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label
                        className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                        htmlFor={`group-${g.group}`}
                      >
                        Group {g.group}
                      </label>
                      {isSaved && (
                        <span className="text-[10px] font-semibold text-emerald-600">Saved</span>
                      )}
                    </div>
                    <TeamSelect
                      id={`group-${g.group}`}
                      value={pick}
                      onChange={(id) =>
                        setGroupChampions((prev) => ({ ...prev, [g.group]: id }))
                      }
                      teams={g.teams}
                      placeholder={`Group ${g.group} winner`}
                      disabled={Boolean(savingGroup) || submitting}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveGroup(g.group)}
                      disabled={!pick || Boolean(savingGroup) || submitting}
                      className="w-full min-h-[40px] rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                    >
                      {isSaving
                        ? 'Saving…'
                        : isSaved
                          ? `Update Group ${g.group}`
                          : `Save Group ${g.group}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h2 className="font-display text-sm font-bold text-slate-900">Knockout bracket</h2>
            <p className="text-xs text-slate-500">
              4 semifinalists → 2 finalists → champion. Apply when the bracket is complete.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([0, 1, 2, 3] as const).map((i) => (
                <TeamSelect
                  key={`semi-${i}`}
                  id={`semi-${i}`}
                  value={semifinalists[i]}
                  onChange={(id) => {
                    const next = [...semifinalists] as [string, string, string, string];
                    next[i] = id;
                    setSemifinalists(next);
                  }}
                  teams={teams}
                  placeholder={`Semifinalist ${i + 1}`}
                  disabled={submitting}
                  excludeIds={[
                    champion,
                    ...finalists,
                    ...semifinalists.filter((_, idx) => idx !== i),
                  ].filter(Boolean)}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([0, 1] as const).map((i) => (
                <TeamSelect
                  key={`final-${i}`}
                  id={`final-${i}`}
                  value={finalists[i]}
                  onChange={(id) => {
                    const next = [...finalists] as [string, string];
                    next[i] = id;
                    setFinalists(next);
                  }}
                  teams={finalistTeams}
                  placeholder={allSemisPicked ? `Finalist ${i + 1}` : 'Pick 4 semifinalists first'}
                  disabled={submitting || !allSemisPicked}
                  excludeIds={[finalists[i === 0 ? 1 : 0]].filter(Boolean)}
                />
              ))}
            </div>

            <TeamSelect
              id="champion"
              value={champion}
              onChange={setChampion}
              teams={championTeams}
              placeholder={
                finalists.every(Boolean) ? 'Champion' : 'Pick both finalists first'
              }
              disabled={submitting || !finalists.every(Boolean)}
            />
          </section>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="w-full min-h-[48px] rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
          >
            {submitting
              ? 'Calculating points…'
              : isAllTenants
                ? 'Apply knockout scoring to all databases'
                : 'Apply knockout scoring'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Tournament;
