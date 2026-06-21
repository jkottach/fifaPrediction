import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getJwtSecret } from '../config/jwtSecret';
import { logger } from '../lib/logger';
import { findUserById } from '../db/repositories';
import { resolveUserFromRequest } from './resolveUser';
import { clearAuthCookie, getTokensFromCookie } from '../utils/authCookie';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role?: 'user' | 'admin';
  };
}

function getBearerToken(req: Request): string | undefined {
  const raw = req.headers.authorization;
  if (!raw || typeof raw !== 'string') return undefined;
  if (raw.startsWith('Bearer ')) return raw.slice(7);
  return raw;
}

/** Headers first, then cookie — order matters when trying each candidate. */
export function collectAccessTokens(req: Request): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  const add = (raw: string | undefined) => {
    const value = raw?.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    tokens.push(value);
  };

  const alt = req.headers['x-access-token'];
  if (typeof alt === 'string') add(alt);

  add(getBearerToken(req));

  // Try every auth_token cookie (duplicate stale + fresh is common after host migration).
  for (const cookieToken of getTokensFromCookie(req)) {
    add(cookieToken);
  }

  return tokens;
}

/** First valid token (used by callers that only need one). */
export function getAccessToken(req: Request): string | undefined {
  return collectAccessTokens(req)[0];
}

function verifyJwtToken(token: string): AuthRequest['user'] {
  return jwt.verify(token, getJwtSecret()) as {
    userId: string;
    email: string;
    role?: 'user' | 'admin';
  };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tokens = collectAccessTokens(req);
    let lastJwtError: string | undefined;

    for (const token of tokens) {
      try {
        req.user = verifyJwtToken(token);
        return next();
      } catch (err) {
        if (err instanceof Error) lastJwtError = err.message;
        // Stale httpOnly cookie vs valid Authorization header — try next source.
      }
    }

    const fromPrincipal = await resolveUserFromRequest(req);
    if (fromPrincipal) {
      req.user = fromPrincipal;
      return next();
    }

    if (tokens.length > 0) {
      // Drop bad cookie so the next request can use a fresh localStorage token.
      clearAuthCookie(res);

      const expired = lastJwtError?.toLowerCase().includes('expired');
      return res.status(401).json({
        error: expired ? 'Token expired' : 'Invalid token',
        hint: expired
          ? 'Please sign in again.'
          : 'Sign out and sign in again. If this persists, check nginx forwards Authorization and X-Access-Token to the API.',
      });
    }

    return res.status(401).json({ error: 'Not authenticated' });
  } catch (error) {
    if (error instanceof Error && error.message === 'JWT_SECRET is not configured') {
      logger.error('authMiddleware', error, { path: req.path });
      return res.status(500).json({ error: 'Server auth is not configured' });
    }
    logger.error('authMiddleware', error, {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await findUserById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    const errorDetails = logger.error('adminMiddleware', error, {
      method: req.method,
      path: req.path,
      userId: req.user?.userId,
    });
    res.status(errorDetails.statusCode || 500).json({ error: 'Server error during authorization' });
  }
};
