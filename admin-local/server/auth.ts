import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const ADMIN_PIN = process.env.ADMIN_PIN || '12189';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const sessions = new Map<string, number>();

function pruneSessions(): void {
  const now = Date.now();
  for (const [token, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(token);
  }
}

export function createSession(): string {
  pruneSessions();
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function validateSession(token: string | undefined): boolean {
  if (!token) return false;
  pruneSessions();
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function revokeSession(token: string | undefined): void {
  if (token) sessions.delete(token);
}

function extractToken(req: Request): string | undefined {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const custom = req.header('x-admin-token');
  return typeof custom === 'string' && custom.trim() ? custom.trim() : undefined;
}

export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!validateSession(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

export function loginWithPin(pin: unknown): { ok: true; token: string } | { ok: false } {
  const normalized = String(pin ?? '').trim();
  if (!normalized || normalized !== ADMIN_PIN) return { ok: false };
  return { ok: true, token: createSession() };
}
