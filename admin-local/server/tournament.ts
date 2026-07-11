import type { Express, Request, Response } from 'express';
import type { Db, Collection, ObjectId } from 'mongodb';
import {
  ALL_TENANT_ID,
  getDbForTenant,
  getTenantDefinition,
  isAllTenantsMode,
  listConfiguredTenants,
  resolveReadTenantId,
} from './tenants.js';
import {
  calculateTournamentPredictionPoints,
  normalizeGroupChampions,
  TOURNAMENT_POINTS,
  validatePartialBracketLogic,
  type GroupChampionsPicks,
  type TournamentBracketPrediction,
  type TournamentOfficialResults,
} from './tournamentScoring.js';

const RESULTS_DOC_ID = 'tournamentResults';

export interface GroupStageGroup {
  group: string;
  teamIds: string[];
}

interface TeamDocument {
  teamId: string;
  teamName: string;
  countryLogo?: string | null;
}

interface MatchDocument {
  team1: string;
  team2: string;
  group?: string | null;
}

interface EmbeddedPrediction {
  points?: number;
}

interface UserDocument {
  _id: ObjectId;
  predictions: EmbeddedPrediction[];
  tournamentPrediction?: TournamentBracketPrediction | null;
  totalPoints: number;
}

interface TournamentResultsDocument extends TournamentOfficialResults {
  _id: typeof RESULTS_DOC_ID;
  updatedAt: Date;
}

type TenantRequest = Request & { tenantId: string; db: Db };

function isPickableNationTeamId(teamId: string): boolean {
  return /^[A-Z]{3}$/.test(teamId) && !/^[0-9W]/.test(teamId);
}

function users(db: Db): Collection<UserDocument> {
  return db.collection<UserDocument>('users');
}

function matches(db: Db): Collection<MatchDocument> {
  return db.collection<MatchDocument>('matches');
}

function teams(db: Db): Collection<TeamDocument> {
  return db.collection<TeamDocument>('teams');
}

function settings(db: Db) {
  return db.collection<TournamentResultsDocument>('settings');
}

function sumMatchPoints(predictions: EmbeddedPrediction[]): number {
  return predictions.reduce((sum, p) => sum + (p.points ?? 0), 0);
}

function computeUserTotalPoints(user: UserDocument): number {
  return sumMatchPoints(user.predictions) + (user.tournamentPrediction?.points ?? 0);
}

export async function listGroupStageGroups(db: Db): Promise<GroupStageGroup[]> {
  const raw = await matches(db)
    .find({ group: { $exists: true, $nin: [null, ''] } })
    .project({ group: 1, team1: 1, team2: 1 })
    .toArray();

  const byGroup = new Map<string, Set<string>>();
  for (const m of raw) {
    const group = m.group?.trim().toUpperCase();
    if (!group) continue;
    if (!byGroup.has(group)) byGroup.set(group, new Set());
    const ids = byGroup.get(group)!;
    if (isPickableNationTeamId(m.team1)) ids.add(m.team1);
    if (isPickableNationTeamId(m.team2)) ids.add(m.team2);
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, teamIds]) => ({
      group,
      teamIds: [...teamIds].sort(),
    }));
}

async function enrichGroups(db: Db, stageGroups: GroupStageGroup[]) {
  const allTeamIds = [...new Set(stageGroups.flatMap((g) => g.teamIds))];
  const teamDocs = allTeamIds.length
    ? await teams(db).find({ teamId: { $in: allTeamIds } }).toArray()
    : [];
  const teamById = new Map(teamDocs.map((t) => [t.teamId, t]));

  return stageGroups.map(({ group, teamIds }) => ({
    group,
    teams: teamIds.map((teamId) => {
      const t = teamById.get(teamId);
      return {
        teamId,
        teamName: t?.teamName ?? teamId,
        countryLogo: t?.countryLogo ?? null,
      };
    }),
  }));
}

async function loadOfficialResults(db: Db): Promise<TournamentOfficialResults | null> {
  const doc = await settings(db).findOne({ _id: RESULTS_DOC_ID });
  if (!doc) return null;
  return {
    champion: doc.champion,
    finalists: doc.finalists,
    semifinalists: doc.semifinalists,
    groupChampions: doc.groupChampions ?? {},
  };
}

async function saveOfficialResults(db: Db, results: TournamentOfficialResults): Promise<void> {
  await settings(db).updateOne(
    { _id: RESULTS_DOC_ID },
    {
      $set: {
        ...results,
        _id: RESULTS_DOC_ID,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

function emptyOfficialResults(): TournamentOfficialResults {
  return {
    champion: '',
    finalists: ['', ''],
    semifinalists: ['', '', '', ''],
    groupChampions: {},
  };
}

function validateSingleGroupChampion(
  group: string,
  teamId: string,
  stageGroups: GroupStageGroup[]
): string | null {
  const normalizedGroup = group.trim().toUpperCase();
  const pick = teamId.trim().toUpperCase();
  if (!normalizedGroup || !pick) return 'Group and team are required';

  const stageGroup = stageGroups.find((g) => g.group === normalizedGroup);
  if (!stageGroup) return `Group ${normalizedGroup} was not found`;
  if (!stageGroup.teamIds.includes(pick)) {
    return `${pick} is not valid in Group ${normalizedGroup}`;
  }
  return null;
}

export async function applyTournamentScoring(db: Db, results: TournamentOfficialResults) {
  await saveOfficialResults(db, results);

  const withPredictions = await users(db)
    .find({ tournamentPrediction: { $exists: true, $ne: null } })
    .toArray();

  let usersUpdated = 0;

  for (const user of withPredictions) {
    const pred = user.tournamentPrediction;
    if (!pred) continue;

    const points = calculateTournamentPredictionPoints(pred, results);
    const nextPrediction: TournamentBracketPrediction = {
      ...pred,
      points,
      updatedAt: new Date(),
    };

    await users(db).updateOne(
      { _id: user._id },
      {
        $set: {
          tournamentPrediction: nextPrediction,
          totalPoints: sumMatchPoints(user.predictions) + points,
          updatedAt: new Date(),
        },
      }
    );
    usersUpdated += 1;
  }

  return { usersUpdated };
}

function parseBracketResultsBody(
  body: Record<string, unknown>,
  existing: TournamentOfficialResults | null
): TournamentOfficialResults {
  const champion = String(body.champion ?? '').trim().toUpperCase();
  const rawFinalists = Array.isArray(body.finalists) ? body.finalists : [];
  const finalists = [0, 1].map((i) =>
    String(rawFinalists[i] ?? '').trim().toUpperCase()
  ) as [string, string];
  const rawSemis = Array.isArray(body.semifinalists) ? body.semifinalists : [];
  const semifinalists = [0, 1, 2, 3].map((i) =>
    String(rawSemis[i] ?? '').trim().toUpperCase()
  ) as [string, string, string, string];
  const groupChampions = {
    ...(existing?.groupChampions ?? {}),
    ...normalizeGroupChampions((body.groupChampions as GroupChampionsPicks) ?? {}),
  };

  // Partial saves are allowed: only the filled slots are validated, so an admin
  // can save results as they come in (e.g. one semifinalist at a time). Points
  // recalculate for whatever is entered so far.
  const logicError = validatePartialBracketLogic(champion, finalists, semifinalists);
  if (logicError) throw new Error(logicError);

  return { champion, finalists, semifinalists, groupChampions };
}

async function applyGroupChampion(
  db: Db,
  group: string,
  teamId: string
): Promise<{ usersUpdated: number; group: string; teamId: string }> {
  const stageGroups = await listGroupStageGroups(db);
  const groupError = validateSingleGroupChampion(group, teamId, stageGroups);
  if (groupError) throw new Error(groupError);

  const normalizedGroup = group.trim().toUpperCase();
  const pick = teamId.trim().toUpperCase();
  const existing = (await loadOfficialResults(db)) ?? emptyOfficialResults();
  const results: TournamentOfficialResults = {
    ...existing,
    groupChampions: {
      ...existing.groupChampions,
      [normalizedGroup]: pick,
    },
  };

  const { usersUpdated } = await applyTournamentScoring(db, results);
  return { usersUpdated, group: normalizedGroup, teamId: pick };
}

export function registerTournamentRoutes(app: Express) {
  app.get('/api/tournament/setup', async (req, res) => {
    const { db, tenantId } = req as TenantRequest;
    try {
      const stageGroups = await listGroupStageGroups(db);
      const groups = await enrichGroups(db, stageGroups);
      const results = await loadOfficialResults(db);
      const tenant = isAllTenantsMode(tenantId)
        ? { id: ALL_TENANT_ID, label: 'All', dbName: 'all databases' }
        : getTenantDefinition(tenantId);

      res.json({
        groups,
        results,
        points: TOURNAMENT_POINTS,
        predictionsCount: await users(db).countDocuments({
          tournamentPrediction: { $exists: true, $ne: null },
        }),
        tenant: { id: tenant.id, label: tenant.label, dbName: tenant.dbName },
        previewTenantId: isAllTenantsMode(tenantId)
          ? resolveReadTenantId(req.header('x-tenant-id') || undefined)
          : undefined,
      });
    } catch (err) {
      console.error('GET /api/tournament/setup', err);
      res.status(500).json({ error: 'Failed to load tournament setup' });
    }
  });

  app.post('/api/local-admin/tournament-results/group', async (req, res) => {
    const { tenantId } = req as TenantRequest;
    const group = String(req.body?.group ?? '').trim();
    const teamId = String(req.body?.teamId ?? '').trim();

    try {
      const runForDb = async (tdb: Db) => applyGroupChampion(tdb, group, teamId);

      if (isAllTenantsMode(tenantId)) {
        const outcomes: Array<{
          tenant: { id: string; label: string; dbName: string };
          ok: boolean;
          usersUpdated?: number;
          error?: string;
        }> = [];

        for (const t of listConfiguredTenants()) {
          const tdb = await getDbForTenant(t.id);
          try {
            const { usersUpdated } = await runForDb(tdb);
            outcomes.push({
              tenant: { id: t.id, label: t.label, dbName: t.dbName },
              ok: true,
              usersUpdated,
            });
          } catch (err) {
            outcomes.push({
              tenant: { id: t.id, label: t.label, dbName: t.dbName },
              ok: false,
              error: err instanceof Error ? err.message : 'Failed',
            });
          }
        }

        const succeeded = outcomes.filter((o) => o.ok);
        if (succeeded.length === 0) {
          return res.status(500).json({ error: 'Failed on all databases', outcomes });
        }

        const failed = outcomes.filter((o) => !o.ok);
        return res.json({
          message:
            failed.length === 0
              ? `Group ${group} winner saved on all ${succeeded.length} databases`
              : `Group ${group} winner saved on ${succeeded.length} of ${outcomes.length} databases`,
          group,
          teamId,
          tenant: { id: ALL_TENANT_ID, label: 'All', dbName: 'all databases' },
          outcomes,
          usersUpdated: succeeded.reduce((n, o) => n + (o.usersUpdated ?? 0), 0),
        });
      }

      const { db } = req as TenantRequest;
      const { usersUpdated } = await runForDb(db);
      const tenant = getTenantDefinition(tenantId);

      res.json({
        message: `Group ${group} winner saved — ${usersUpdated} user(s) updated`,
        group,
        teamId,
        usersUpdated,
        tenant: { id: tenant.id, label: tenant.label, dbName: tenant.dbName },
      });
    } catch (err) {
      console.error('POST /api/local-admin/tournament-results/group', err);
      const message = err instanceof Error ? err.message : 'Failed to save group winner';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/local-admin/tournament-results', async (req, res) => {
    const { tenantId } = req as TenantRequest;
    try {
      const runForDb = async (tdb: Db) => {
        const existing = await loadOfficialResults(tdb);
        const results = parseBracketResultsBody(req.body ?? {}, existing);
        return applyTournamentScoring(tdb, results);
      };

      if (isAllTenantsMode(tenantId)) {
        const outcomes: Array<{
          tenant: { id: string; label: string; dbName: string };
          ok: boolean;
          usersUpdated?: number;
          error?: string;
        }> = [];

        for (const t of listConfiguredTenants()) {
          const tdb = await getDbForTenant(t.id);
          try {
            const { usersUpdated } = await runForDb(tdb);
            outcomes.push({
              tenant: { id: t.id, label: t.label, dbName: t.dbName },
              ok: true,
              usersUpdated,
            });
          } catch (err) {
            outcomes.push({
              tenant: { id: t.id, label: t.label, dbName: t.dbName },
              ok: false,
              error: err instanceof Error ? err.message : 'Failed',
            });
          }
        }

        const succeeded = outcomes.filter((o) => o.ok);
        if (succeeded.length === 0) {
          return res.status(500).json({ error: 'Failed on all databases', outcomes });
        }

        const failed = outcomes.filter((o) => !o.ok);
        return res.json({
          message:
            failed.length === 0
              ? `Tournament scoring applied on all ${succeeded.length} databases`
              : `Tournament scoring applied on ${succeeded.length} of ${outcomes.length} databases`,
          tenant: { id: ALL_TENANT_ID, label: 'All', dbName: 'all databases' },
          outcomes,
          usersUpdated: succeeded.reduce((n, o) => n + (o.usersUpdated ?? 0), 0),
        });
      }

      const { db } = req as TenantRequest;
      const { usersUpdated } = await runForDb(db);
      const tenant = getTenantDefinition(tenantId);

      res.json({
        message: `Tournament scoring applied — ${usersUpdated} user(s) updated`,
        usersUpdated,
        tenant: { id: tenant.id, label: tenant.label, dbName: tenant.dbName },
      });
    } catch (err) {
      console.error('POST /api/local-admin/tournament-results', err);
      const message = err instanceof Error ? err.message : 'Failed to apply tournament scoring';
      res.status(400).json({ error: message });
    }
  });
}

export { computeUserTotalPoints, sumMatchPoints };
