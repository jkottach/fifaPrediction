import type { Request, Response } from 'express';
import { getJwtExpiresIn } from '../config/jwtSecret';

export const AUTH_COOKIE_NAME = 'auth_token';

function cookieMaxAgeMs(): number {
  const raw = getJwtExpiresIn();
  if (raw.endsWith('d')) return parseInt(raw, 10) * 24 * 60 * 60 * 1000;
  if (raw.endsWith('h')) return parseInt(raw, 10) * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: cookieMaxAgeMs(),
    path: '/',
  });
}

const COOKIE_CLEAR_PATHS = ['/', '/api'] as const;

function cookieClearOptions(path: string) {
  return {
    path,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };
}

/** Clear duplicate auth_token cookies (e.g. after Azure → EC2 migration). */
export function clearAuthCookie(res: Response): void {
  for (const path of COOKIE_CLEAR_PATHS) {
    res.clearCookie(AUTH_COOKIE_NAME, cookieClearOptions(path));
  }
}

/** All auth_token values from Cookie header (browsers may send duplicates). */
export function getTokensFromCookie(req: Request): string[] {
  const raw = req.headers.cookie;
  if (!raw || typeof raw !== 'string') return [];

  const tokens: string[] = [];
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq);
    if (name !== AUTH_COOKIE_NAME) continue;
    const value = decodeURIComponent(trimmed.slice(eq + 1)).trim();
    if (value) tokens.push(value);
  }
  return tokens;
}

/** Last auth_token in the header — usually the newest after re-login. */
export function getTokenFromCookie(req: Request): string | undefined {
  const tokens = getTokensFromCookie(req);
  return tokens.length > 0 ? tokens[tokens.length - 1] : undefined;
}
