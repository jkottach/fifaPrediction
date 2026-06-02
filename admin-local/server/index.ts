/**
 * Standalone local admin API — does not use the main Kanhans API.
 * Connects to one or more MongoDB databases (tenants) and runs scoring + leaderboard updates.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { ObjectId, type Db, type Collection } from 'mongodb';
import {
  getDbForTenant,
  getTenantCatalog,
  getTenantDefinition,
  resolveTenantId,
} from './tenants.js';

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
}

interface UserDocument {
  _id: ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
  predictions: EmbeddedPrediction[];
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

function tenantFromRequest(req: Request): string {
  const header = req.header('x-tenant-id');
  const query = typeof req.query.tenant === 'string' ? req.query.tenant : undefined;
  return resolveTenantId(header || query);
}

async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantFromRequest(req);
    const db = await getDbForTenant(tenantId);
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

// ── Scoring (same rules as main API) ─────────────────────────────────────────

function calculatePredictionPoints(
  predictedTeam1: number,
  predictedTeam2: number,
  actualTeam1: number,
  actualTeam2: number
): number {
  let points = 0;
  const predictedDiff = predictedTeam1 - predictedTeam2;
  const actualDiff = actualTeam1 - actualTeam2;

  if (
    (predictedDiff > 0 && actualDiff > 0) ||
    (predictedDiff < 0 && actualDiff < 0) ||
    (predictedDiff === 0 && actualDiff === 0)
  ) {
    points += 5;
  }
  if (predictedTeam1 === actualTeam1) points += 2;
  if (predictedTeam2 === actualTeam2) points += 2;
  if (Math.abs(predictedDiff) === Math.abs(actualDiff)) points += 1;

  return points;
}

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
    p.matchId === matchId ? { ...p, points } : p
  );

  await users(db).updateOne(
    { _id: oid },
    {
      $set: {
        predictions: nextPredictions,
        totalPoints: sumPredictionPoints(nextPredictions),
        updatedAt: new Date(),
      },
    }
  );
}

async function processMatchResults(
  db: Db,
  matchId: string,
  actualTeam1: number,
  actualTeam2: number
) {
  const withPredictions = await users(db).find({ 'predictions.matchId': matchId }).toArray();

  for (const user of withPredictions) {
    const prediction = user.predictions.find((p) => p.matchId === matchId);
    if (!prediction) continue;

    const points = calculatePredictionPoints(
      prediction.team1Score,
      prediction.team2Score,
      actualTeam1,
      actualTeam2
    );
    await updatePredictionPointsForMatch(db, user._id.toString(), matchId, points);
  }
}

async function finalizeMatchScores(
  db: Db,
  matchId: string,
  team1Score: number,
  team2Score: number
) {
  const oid = toObjectId(matchId);
  if (!oid) throw new Error('Match not found');

  const result = await matches(db).findOneAndUpdate(
    { _id: oid },
    {
      $set: {
        team1Score,
        team2Score,
        status: 'completed',
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!result) throw new Error('Match not found');

  await processMatchResults(db, matchId, team1Score, team2Score);
  return result;
}

// ── Express app ────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'admin-local' });
});

app.get('/api/tenants', (_req, res) => {
  const catalog = getTenantCatalog();
  res.json({
    tenants: catalog.tenants.map((t) => ({
      id: t.id,
      label: t.label,
      dbName: t.dbName,
    })),
    defaultTenantId: catalog.defaultTenantId || catalog.tenants[0]?.id,
  });
});

app.use('/api', tenantMiddleware);

app.get('/api/matches', async (req, res) => {
  const { db, tenantId } = req as TenantRequest;
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '100'), 10) || 100));
    const status = typeof req.query.status === 'string' && req.query.status.trim()
      ? req.query.status.trim()
      : undefined;

    const data = await listMatchesEnriched(db, status, page, limit);
    const tenant = getTenantDefinition(tenantId);
    res.json({ ...data, tenant: { id: tenant.id, label: tenant.label, dbName: tenant.dbName } });
  } catch (err) {
    console.error('GET /api/matches', err);
    res.status(500).json({ error: 'Failed to fetch matches' });
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
  const { db, tenantId } = req as TenantRequest;
  try {
    const { matchId, team1Score, team2Score } = req.body ?? {};
    if (!matchId || team1Score === undefined || team2Score === undefined) {
      return res.status(400).json({ error: 'matchId, team1Score, and team2Score are required' });
    }

    const updated = await finalizeMatchScores(
      db,
      String(matchId),
      Number(team1Score),
      Number(team2Score)
    );
    const teamIds = [updated.team1, updated.team2];
    const teamDocs = await teams(db).find({ teamId: { $in: teamIds } }).toArray();
    const teamById = new Map(teamDocs.map((t) => [t.teamId, t]));
    const tenant = getTenantDefinition(tenantId);

    res.json({
      message: 'Match finalized and points calculated successfully',
      match: formatMatchForApi(updated, teamById),
      tenant: { id: tenant.id, label: tenant.label, dbName: tenant.dbName },
    });
  } catch (err) {
    console.error('POST /api/local-admin/finalize-match', err);
    const message = err instanceof Error ? err.message : 'Failed to finalize match';
    res.status(500).json({ error: message });
  }
});

async function main() {
  const catalog = getTenantCatalog();
  console.log(
    `Admin tenants: ${catalog.tenants.map((t) => `${t.label} (${t.dbName})`).join(', ')}`
  );
  const server = app.listen(PORT, () => {
    console.log(`✓ Admin API listening on http://localhost:${PORT}`);
    console.log(`  UI: npm run dev:client → http://localhost:3001 (proxies /api here)`);
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
