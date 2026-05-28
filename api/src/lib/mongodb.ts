import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import type { MatchDocument, TeamDocument, UserDocument } from '../db/types';

const USERS_COLLECTION = 'users';
const TEAMS_COLLECTION = 'teams';
const MATCHES_COLLECTION = 'matches';

let client: MongoClient | null = null;
let database: Db | null = null;

function getMongoDbName(): string {
  const dbName = process.env.MONGODB_DB?.trim();
  if (!dbName) {
    throw new Error(
      'MONGODB_DB is required. Set it in api/.env or Azure application settings.'
    );
  }
  return dbName;
}

export async function connectMongo(): Promise<Db> {
  if (database) return database;

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const dbName = getMongoDbName();

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15_000,
    connectTimeoutMS: 15_000,
  });
  await client.connect();
  database = client.db(dbName);

  await ensureIndexes(database);
  console.log(`✓ MongoDB connected (${dbName})`);
  return database;
}

async function safeIndex(
  label: string,
  fn: () => Promise<string | void>
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.warn(`MongoDB index warning (${label}):`, err instanceof Error ? err.message : err);
  }
}

async function ensureIndexes(db: Db): Promise<void> {
  const users = db.collection<UserDocument>(USERS_COLLECTION);
  const teams = db.collection<TeamDocument>(TEAMS_COLLECTION);
  const matches = db.collection<MatchDocument>(MATCHES_COLLECTION);

  await safeIndex('users.email', () => users.createIndex({ email: 1 }, { unique: true }));
  await safeIndex('users.totalPoints', () => users.createIndex({ totalPoints: -1 }));
  await safeIndex('users.predictions.matchId', () =>
    users.createIndex({ 'predictions.matchId': 1 })
  );

  await safeIndex('teams.teamId', () => teams.createIndex({ teamId: 1 }, { unique: true }));

  await safeIndex('matches.matchTime', () => matches.createIndex({ matchTime: 1 }));
  await safeIndex('matches.status', () => matches.createIndex({ status: 1 }));
  await safeIndex('matches.sequence', () => matches.createIndex({ sequence: 1 }));
}

/** Ping MongoDB (for health checks). */
export async function pingMongo(): Promise<{ ok: boolean; db: string; error?: string }> {
  try {
    const db = await connectMongo();
    await db.command({ ping: 1 });
    return { ok: true, db: db.databaseName };
  } catch (err) {
    return {
      ok: false,
      db: process.env.MONGODB_DB?.trim() ?? 'unknown',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function getDb(): Db {
  if (!database) {
    throw new Error('MongoDB not connected. Call connectMongo() first.');
  }
  return database;
}

export function getUsersCollection(): Collection<UserDocument> {
  return getDb().collection<UserDocument>(USERS_COLLECTION);
}

export function getTeamsCollection(): Collection<TeamDocument> {
  return getDb().collection<TeamDocument>(TEAMS_COLLECTION);
}

export function getMatchesCollection(): Collection<MatchDocument> {
  return getDb().collection<MatchDocument>(MATCHES_COLLECTION);
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
}

export function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}
