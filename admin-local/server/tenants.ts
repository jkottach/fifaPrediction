import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, type Db } from 'mongodb';

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface TenantDefinition {
  id: string;
  label: string;
  dbName: string;
  /** Optional per-tenant URI; defaults to MONGODB_URI */
  uri?: string;
}

export interface TenantsFile {
  defaultTenantId?: string;
  tenants: TenantDefinition[];
}

interface TenantConnection {
  client: MongoClient;
  db: Db;
}

const connections = new Map<string, TenantConnection>();

function configPath(): string {
  return path.join(adminRoot, 'tenants.config.json');
}

function parseEnvTenants(): TenantDefinition[] {
  const raw = process.env.ADMIN_TENANTS?.trim();
  if (!raw) return [];

  return raw.split(',').map((entry) => {
    const [id, dbName, label] = entry.split(':').map((s) => s.trim());
    if (!id || !dbName) {
      throw new Error(
        'ADMIN_TENANTS must be "id:dbName:Label" entries separated by commas'
      );
    }
    return { id, dbName, label: label || id };
  });
}

export function loadTenantDefinitions(): TenantsFile {
  const fromEnv = parseEnvTenants();
  if (fromEnv.length > 0) {
    return {
      defaultTenantId: process.env.ADMIN_DEFAULT_TENANT || fromEnv[0].id,
      tenants: fromEnv,
    };
  }

  const file = configPath();
  if (fs.existsSync(file)) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as TenantsFile;
    if (!Array.isArray(parsed.tenants) || parsed.tenants.length === 0) {
      throw new Error(`${file} must include a non-empty "tenants" array`);
    }
    return parsed;
  }

  const dbName = process.env.MONGODB_DB || 'fifaPrediction';
  return {
    defaultTenantId: 'default',
    tenants: [{ id: 'default', label: 'Default', dbName }],
  };
}

let cachedDefinitions: TenantsFile | null = null;

export function getTenantCatalog(): TenantsFile {
  if (!cachedDefinitions) {
    cachedDefinitions = loadTenantDefinitions();
  }
  return cachedDefinitions;
}

export function resolveTenantId(requested?: string): string {
  const catalog = getTenantCatalog();
  const id = requested?.trim() || catalog.defaultTenantId || catalog.tenants[0].id;
  if (!catalog.tenants.some((t) => t.id === id)) {
    throw new Error(`Unknown tenant "${id}"`);
  }
  return id;
}

export function getTenantDefinition(tenantId: string): TenantDefinition {
  const tenant = getTenantCatalog().tenants.find((t) => t.id === tenantId);
  if (!tenant) throw new Error(`Unknown tenant "${tenantId}"`);
  return tenant;
}

export async function getDbForTenant(tenantId: string): Promise<Db> {
  const existing = connections.get(tenantId);
  if (existing) return existing.db;

  const tenant = getTenantDefinition(tenantId);
  const uri =
    tenant.uri?.trim() ||
    process.env.MONGODB_URI?.trim() ||
    '';
  if (!uri) {
    throw new Error('MONGODB_URI is required in admin-local/.env (or per-tenant uri)');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(tenant.dbName);
  connections.set(tenantId, { client, db });
  console.log(`✓ Connected tenant "${tenant.label}" → ${tenant.dbName}`);
  return db;
}

export async function connectAllTenants(): Promise<void> {
  const { tenants } = getTenantCatalog();
  await Promise.all(tenants.map((t) => getDbForTenant(t.id)));
}
