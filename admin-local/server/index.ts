/**
 * Standalone local admin API — does not use the main Kanhans API.
 * Connects to one or more MongoDB databases (tenants) and runs scoring + leaderboard updates.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { ObjectId, type Db, type Collection } from 'mongodb';
import {
  ALL_TENANT_ID,
  getDbForTenant,
  getTenantCatalog,
  getTenantDefinition,
  isAllTenantsMode,
  listConfiguredTenants,
  resolveReadTenantId,
  resolveTenantId,
} from './tenants.js';
import { registerTournamentRoutes, sumMatchPoints } from './tournament.js';
import type { TournamentBracketPrediction } from './tournamentScoring.js';
import { computeGroupStandings } from './groupStandings.js';
import { resolveKnockoutTeams, type ResolvedMatchUpdate } from './knockoutResolver.js';
import { applySnapshotsAfterMatchFinalized } from './predictionSnapshots.js';
import { isKnockoutMatch } from './knockout.js';
import { SCORING_VERSION, scorePredictionForMatch } from './scoringService.js';
import {
  adminAuthMiddleware,
  loginWithPin,
  revokeSession,
  validateSession,
} from './auth.js';

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(adminRoot, '.env') });

const PORT = Number(process.env.ADMIN_PORT) || 5002;

// ── Types (mirror main DB) ───────────────────────────────────────────────────

interface EmbeddedPrediction {
  matchId: string;
  matchTag: string;
  team1Score: number;
  team2Score: number;
  points: number;
  comment?: string | null;
  submittedTime: Date;
  penaltyWinner?: string | null;
  cumulativeTotalPoints?: number;
  overallRank?: number | null;
}

interface UserDocument {
  _id: ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
  predictions: EmbeddedPrediction[];
  tournamentPrediction?: TournamentBracketPrediction | null;
  isActive?: boolean;
  state?: string;
}

interface TeamDocument {
  teamId: string;
  teamName: string;
  countryLogo?: string | null;
}

interface MatchDocument {
  _id: ObjectId;
  sequence: number;
  team1: string;
  team2: string;
  team1Info?: { teamName: string; countryLogo?: string | null } | null;
  team2Info?: { teamName: string; countryLogo?: string | null } | null;
  team1Score?: number | null;
  team2Score?: number | null;
  penaltyWinner?: string | null;
  matchTime: Date;
  predictionsEndingTime: Date;
  round: string;
  group?: string | null;
  comment?: string | null;
  matchTag: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

type TenantRequest = Request & { tenantId: string; db: Db };

function users(db: Db): Collection<UserDocument> {
  return db.collection<UserDocument>('users');
}

function matches(db: Db): Collection<MatchDocument> {
  return db.collection<MatchDocument>('matches');
}

function teams(db: Db): Collection<TeamDocument> {
  return db.collection<TeamDocument>('teams');
}

function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function sumPredictionPoints(predictions: { points?: number }[]): number {
  return predictions.reduce((sum, p) => sum + (p.points ?? 0), 0);
}

async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header('x-tenant-id');
    const query = typeof req.query.tenant === 'string' ? req.query.tenant : undefined;
    const tenantId = resolveTenantId(header || query);
    const readTenantId = resolveReadTenantId(header || query);
    const db = await getDbForTenant(readTenantId);
    (req as TenantRequest).tenantId = tenantId;
    (req as TenantRequest).db = db;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid tenant';
    res.status(400).json({ error: message });
  }
}

// ── Match formatting ───────────────────────────────────────────────────────────

function formatMatchForApi(match: MatchDocument, teamById: Map<string, TeamDocument>) {
  const info1 = teamById.get(match.team1);
  const info2 = teamById.get(match.team2);
  const toIso = (v: Date) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());

  return {
    matchId: match._id.toString(),
    _id: match._id.toString(),
    sequence: match.sequence ?? 0,
    team1: String(match.team1 ?? ''),
    team2: String(match.team2 ?? ''),
    team1Info: match.team1Info ?? (info1 ? { teamName: info1.teamName, countryLogo: info1.countryLogo ?? null } : null),
    team2Info: match.team2Info ?? (info2 ? { teamName: info2.teamName, countryLogo: info2.countryLogo ?? null } : null),
    team1Score: match.team1Score ?? null,
    team2Score: match.team2Score ?? null,
    penaltyWinner: match.penaltyWinner ?? null,
    matchTime: toIso(match.matchTime),
    predictionsEndingTime: toIso(match.predictionsEndingTime),
    round: match.round ?? '',
    group: match.group ?? null,
    comment: match.comment ?? null,
    matchTag: match.matchTag ?? '',
    status: match.status ?? 'scheduled',
  };
}

async function listMatchesEnriched(
  db: Db,
  status: string | undefined,
  page: number,
  limit: number
) {
  const filter: Record<string, string> = {};
  if (status) filter.status = status;

  const col = matches(db);
  const [raw, total] = await Promise.all([
    col
      .find(filter)
      .sort({ matchTime: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    col.countDocuments(filter),
  ]);

  const teamIds = [...new Set(raw.flatMap((m) => [m.team1, m.team2]))];
  const teamDocs = teamIds.length ? await teams(db).find({ teamId: { $in: teamIds } }).toArray() : [];
  const teamById = new Map(teamDocs.map((t) => [t.teamId, t]));

  return {
    matches: raw.map((m) => formatMatchForApi(m, teamById)),
    pagination: { total, page, limit, pages: limit > 0 ? Math.ceil(total / limit) : 0 },
  };
}

function matchIdsEqual(a: unknown, b: unknown): boolean {
  return String(a) === String(b);
}

async function findUsersWithPredictionForMatch(db: Db, matchId: string): Promise<UserDocument[]> {
  const oid = toObjectId(matchId);
  const filter = oid
    ? { $or: [{ 'predictions.matchId': matchId }, { 'predictions.matchId': oid as unknown as string }] }
    : { 'predictions.matchId': matchId };
  return users(db).find(filter).toArray();
}

// ── Scoring (synced with main API — see server/scoringService.ts) ─────────────

async function updatePredictionPointsForMatch(
  db: Db,
  userId: string,
  matchId: string,
  points: number
) {
  const oid = toObjectId(userId);
  if (!oid) return;

  const user = await users(db).findOne({ _id: oid });
  if (!user) return;

  const nextPredictions = user.predictions.map((p) =>
    matchIdsEqual(p.matchId, matchId) ? { ...p, points } : p
  );

  const tournamentPts = user.tournamentPrediction?.points ?? 0;
  await users(db).updateOne(
    { _id: oid },
    {
      $set: {
        predictions: nextPredictions,
        totalPoints: sumMatchPoints(nextPredictions) + tournamentPts,
        updatedAt: new Date(),
      },
    }
  );
}

async function processMatchResults(db: Db, match: MatchDocument) {
  if (match.team1Score == null || match.team2Score == null) {
    throw new Error('Match scores not set');
  }

  const matchId = match._id.toString();
  const withPredictions = await findUsersWithPredictionForMatch(db, matchId);

  for (const user of withPredictions) {
    const prediction = user.predictions.find((p) => matchIdsEqual(p.matchId, matchId));
    if (!prediction) continue;

    const points = scorePredictionForMatch(
      {
        round: match.round,
        group: match.group,
        sequence: match.sequence,
        team1: match.team1,
        team2: match.team2,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        penaltyWinner: match.penaltyWinner,
      },
      prediction
    );

    await updatePredictionPointsForMatch(db, user._id.toString(), matchId, points);
  }

  await applySnapshotsAfterMatchFinalized(db, users(db), matches(db), matchId);
}

async function findMatchDocument(
  db: Db,
  matchId: string,
  matchTag?: string
): Promise<MatchDocument | null> {
  const oid = toObjectId(matchId);
  if (oid) {
    const byId = await matches(db).findOne({ _id: oid });
    if (byId) return byId;
  }
  const tag = matchTag?.trim();
  if (tag) {
    return matches(db).findOne({ matchTag: tag });
  }
  return null;
}

async function finalizeMatchScores(
  db: Db,
  matchId: string,
  team1Score: number,
  team2Score: number,
  matchTag?: string,
  penaltyWinner?: string | null
): Promise<{ match: MatchDocument; resolved: ResolvedMatchUpdate[] }> {
  const existing = await findMatchDocument(db, matchId, matchTag);
  if (!existing) throw new Error('Match not found');

  const isDraw = team1Score === team2Score;
  const knockout = isKnockoutMatch(existing);
  let resolvedPenaltyWinner: string | null = null;

  if (isDraw && knockout) {
    const pick = String(penaltyWinner ?? '').trim();
    if (!pick || (pick !== existing.team1 && pick !== existing.team2)) {
      throw new Error('Pick who won the penalty shootout for a knockout draw');
    }
    resolvedPenaltyWinner = pick;
  }

  const result = await matches(db).findOneAndUpdate(
    { _id: existing._id },
    {
      $set: {
        team1Score,
        team2Score,
        penaltyWinner: resolvedPenaltyWinner,
        status: 'completed',
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!result) throw new Error('Match not found');

  await processMatchResults(db, result);
  const resolved = await resolveKnockoutTeams(db, matches(db), teams(db));
  return { match: result, resolved };
}

async function runKnockoutResolver(db: Db): Promise<ResolvedMatchUpdate[]> {
  return resolveKnockoutTeams(db, matches(db), teams(db));
}

// ── Express app ────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'admin-local', scoringVersion: SCORING_VERSION });
});

app.post('/api/auth/login', (req, res) => {
  const result = loginWithPin(req.body?.pin);
  if (!result.ok) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }
  res.json({ token: result.token });
});

app.get('/api/auth/session', (req, res) => {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : req.header('x-admin-token');
  if (!validateSession(token ?? undefined)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ authenticated: true });
});

app.post('/api/auth/logout', (req, res) => {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : req.header('x-admin-token');
  revokeSession(token ?? undefined);
  res.json({ message: 'Logged out' });
});

app.use('/api', adminAuthMiddleware);

app.get('/api/tenants', (_req, res) => {
  const catalog = getTenantCatalog();
  res.json({
    tenants: catalog.tenants.map((t) => ({
      id: t.id,
      label: t.label,
      dbName: t.dbName,
      url: t.url ?? null,
    })),
    defaultTenantId: catalog.defaultTenantId || catalog.tenants[0]?.id,
    allTenantId: ALL_TENANT_ID,
    supportsAllTenants: catalog.tenants.length > 1,
  });
});

app.use('/api', tenantMiddleware);
registerTournamentRoutes(app);

app.get('/api/matches', async (req, res) => {
  const { db, tenantId } = req as TenantRequest;
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '100'), 10) || 100));
    const status = typeof req.query.status === 'string' && req.query.status.trim()
      ? req.query.status.trim()
      : undefined;

    const data = await listMatchesEnriched(db, status, page, limit);
    if (isAllTenantsMode(tenantId)) {
      res.json({
        ...data,
        tenant: { id: ALL_TENANT_ID, label: 'All', dbName: 'all databases' },
        previewTenantId: resolveReadTenantId(req.header('x-tenant-id') || undefined),
      });
      return;
    }
    const tenant = getTenantDefinition(tenantId);
    res.json({ ...data, tenant: { id: tenant.id, label: tenant.label, dbName: tenant.dbName } });
  } catch (err) {
    console.error('GET /api/matches', err);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

app.get('/api/group-standings', async (req, res) => {
  const { db, tenantId } = req as TenantRequest;
  try {
    const standings = await computeGroupStandings(matches(db));
    if (isAllTenantsMode(tenantId)) {
      res.json({
        standings,
        tenant: { id: ALL_TENANT_ID, label: 'All', dbName: 'all databases' },
        previewTenantId: resolveReadTenantId(req.header('x-tenant-id') || undefined),
      });
      return;
    }
    const tenant = getTenantDefinition(tenantId);
    res.json({
      standings,
      tenant: { id: tenant.id, label: tenant.label, dbName: tenant.dbName },
    });
  } catch (err) {
    console.error('GET /api/group-standings', err);
    res.status(500).json({ error: 'Failed to fetch group standings' });
  }
});

app.post('/api/local-admin/resolve-knockout-teams', async (req, res) => {
  const { tenantId } = req as TenantRequest;
  try {
    if (isAllTenantsMode(tenantId)) {
      const outcomes: Array<{
        tenant: { id: string; label: string; dbName: string };
        ok: boolean;
        resolved?: ResolvedMatchUpdate[];
        error?: string;
      }> = [];

      for (const t of listConfiguredTenants()) {
        const tdb = await getDbForTenant(t.id);
        try {
          const resolved = await runKnockoutResolver(tdb);
          outcomes.push({
            tenant: { id: t.id, label: t.label, dbName: t.dbName },
            ok: true,
            resolved,
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
        return res.status(500).json({ error: 'Failed to resolve on any database', outcomes });
      }

      return res.json({
        message: `Knockout teams resolved on ${succeeded.length} of ${outcomes.length} databases`,
        resolved: succeeded.flatMap((o) => o.resolved ?? []),
        tenant: { id: ALL_TENANT_ID, label: 'All', dbName: 'all databases' },
        outcomes,
      });
    }

    const { db } = req as TenantRequest;
    const resolved = await runKnockoutResolver(db);
    const tenant = getTenantDefinition(tenantId);
    res.json({
      message:
        resolved.length > 0
          ? `Updated ${resolved.length} knockout match(es)`
          : 'No knockout matches needed updating',
      resolved,
      tenant: { id: tenant.id, label: tenant.label, dbName: tenant.dbName },
    });
  } catch (err) {
    console.error('POST /api/local-admin/resolve-knockout-teams', err);
    const message = err instanceof Error ? err.message : 'Failed to resolve knockout teams';
    res.status(500).json({ error: message });
  }
});

app.get('/api/leaderboard/top', async (req, res) => {
  const { db, tenantId } = req as TenantRequest;
  try {
    const limit = Math.min(100, parseInt(String(req.query.limit ?? '30'), 10) || 30);
    const activeFilter = { $or: [{ isActive: true }, { isActive: { $exists: false } }] };

    const topUsers = await users(db)
      .find(activeFilter)
      .sort({ totalPoints: -1, updatedAt: 1 })
      .limit(limit)
      .toArray();

    if (isAllTenantsMode(tenantId)) {
      res.json({ leaderboard: [], source: 'admin-local', tenant: { id: ALL_TENANT_ID, label: 'All', dbName: 'all databases' } });
      return;
    }
    const tenant = getTenantDefinition(tenantId);
    res.json({
      leaderboard: topUsers.map((user, index) => ({
        rank: index + 1,
        totalPoints: user.totalPoints ?? 0,
        name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'User',
        state: user.state || '',
        userId: user._id.toString(),
        email: user.email ?? '',
      })),
      source: 'admin-local',
      tenant: { id: tenant.id, label: tenant.label, dbName: tenant.dbName },
    });
  } catch (err) {
    console.error('GET /api/leaderboard/top', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

app.post('/api/local-admin/finalize-match', async (req, res) => {
  const { tenantId } = req as TenantRequest;
  try {
    const { matchId, team1Score, team2Score, matchTag, penaltyWinner } = req.body ?? {};
    if (!matchId || team1Score === undefined || team2Score === undefined) {
      return res.status(400).json({ error: 'matchId, team1Score, and team2Score are required' });
    }

    const scores = { team1Score: Number(team1Score), team2Score: Number(team2Score) };
    const tag = typeof matchTag === 'string' ? matchTag : undefined;
    const penalty =
      typeof penaltyWinner === 'string' && penaltyWinner.trim() ? penaltyWinner.trim() : null;

    if (isAllTenantsMode(tenantId)) {
      const outcomes: Array<{
        tenant: { id: string; label: string; dbName: string };
        ok: boolean;
        error?: string;
      }> = [];

      const previewTenantId = resolveReadTenantId(tenantId);
      let previewMatch: ReturnType<typeof formatMatchForApi> | null = null;
      let fallbackMatch: ReturnType<typeof formatMatchForApi> | null = null;
      let allResolved: ResolvedMatchUpdate[] = [];

      for (const t of listConfiguredTenants()) {
        const tdb = await getDbForTenant(t.id);
        try {
          const { match: updated, resolved } = await finalizeMatchScores(
            tdb,
            String(matchId),
            scores.team1Score,
            scores.team2Score,
            tag,
            penalty
          );
          const teamIds = [updated.team1, updated.team2];
          const teamDocs = await teams(tdb).find({ teamId: { $in: teamIds } }).toArray();
          const teamById = new Map(teamDocs.map((team) => [team.teamId, team]));
          const formatted = formatMatchForApi(updated, teamById);
          if (t.id === previewTenantId) previewMatch = formatted;
          if (!fallbackMatch) fallbackMatch = formatted;
          if (resolved.length > 0) allResolved = resolved;
          outcomes.push({
            tenant: { id: t.id, label: t.label, dbName: t.dbName },
            ok: true,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed';
          outcomes.push({
            tenant: { id: t.id, label: t.label, dbName: t.dbName },
            ok: false,
            error: message,
          });
        }
      }

      const succeeded = outcomes.filter((o) => o.ok);
      if (succeeded.length === 0) {
        return res.status(500).json({
          error: 'Failed to update any database',
          outcomes,
        });
      }

      const failed = outcomes.filter((o) => !o.ok);
      return res.json({
        message:
          failed.length === 0
            ? `Match finalized on all ${succeeded.length} databases`
            : `Match finalized on ${succeeded.length} of ${outcomes.length} databases`,
        match: previewMatch ?? fallbackMatch,
        resolved: allResolved,
        tenant: { id: ALL_TENANT_ID, label: 'All', dbName: 'all databases' },
        outcomes,
      });
    }

    const { db } = req as TenantRequest;
    const { match: updated, resolved } = await finalizeMatchScores(
      db,
      String(matchId),
      scores.team1Score,
      scores.team2Score,
      tag,
      penalty
    );
    const teamIds = [updated.team1, updated.team2];
    const teamDocs = await teams(db).find({ teamId: { $in: teamIds } }).toArray();
    const teamById = new Map(teamDocs.map((t) => [t.teamId, t]));
    const tenant = getTenantDefinition(tenantId);

    res.json({
      message: 'Match finalized and points calculated successfully',
      match: formatMatchForApi(updated, teamById),
      resolved,
      tenant: { id: tenant.id, label: tenant.label, dbName: tenant.dbName },
    });
  } catch (err) {
    console.error('POST /api/local-admin/finalize-match', err);
    const message = err instanceof Error ? err.message : 'Failed to finalize match';
    res.status(500).json({ error: message });
  }
});

const distPath = path.join(adminRoot, 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

async function main() {
  const catalog = getTenantCatalog();
  console.log(
    `Admin tenants: ${catalog.tenants.map((t) => `${t.label} (${t.dbName})`).join(', ')}`
  );
  const server = app.listen(PORT, () => {
    console.log(`✓ Admin listening on http://localhost:${PORT}`);
    if (process.env.NODE_ENV === 'production') {
      console.log('  Production mode: serving UI from dist/');
    } else {
      console.log('  Dev UI: npm run dev:client → http://localhost:3001 (proxies /api here)');
    }
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n✗ Port ${PORT} is already in use. Stop the other process:\n  lsof -ti :${PORT} | xargs kill -9\n`
      );
      process.exit(1);
    }
    throw err;
  });
}

main().catch((err) => {
  console.error('Admin server failed to start:', err);
  process.exit(1);
});
