import { Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import { generateToken } from '../utils/auth';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie';
import { capitalizeProperNoun } from '../utils/stringUtils';
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserById,
} from '../db/repositories';
import { formatUserForAuth, formatUserId, formatUserProfile } from '../db/helpers';

const client = new OAuth2Client();

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { email, firstName, lastName, city, state, country, phoneNumber } = req.body;

    const existingUser = await findUserByEmail(email);
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    if (!phoneNumber || !String(phoneNumber).trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const createdUser = await createUser({
      email,
      firstName: capitalizeProperNoun(firstName),
      lastName: capitalizeProperNoun(lastName),
      city: capitalizeProperNoun(city) || '',
      state: capitalizeProperNoun(state) || '',
      country: capitalizeProperNoun(country) || '',
      phoneNumber,
      status: 'active',
      isActive: true,
      role: 'user',
    });

    const token = generateToken(formatUserId(createdUser), email, 'user');
    clearAuthCookie(res);
    setAuthCookie(res, token);
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: formatUserForAuth(createdUser),
    });
  } catch (error) {
    const errorDetails = logger.error('register', error, {
      method: req.method,
      path: req.path,
      email: req.body?.email,
    });
    res.status(errorDetails.statusCode || 500).json({ error: 'Registration failed' });
  }
};

export const login = async (_req: AuthRequest, res: Response) => {
  res.status(400).json({ error: 'Password login is disabled. Please use Google login.' });
};

export const logout = async (_req: AuthRequest, res: Response) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
};

export const googleLogin = async (req: AuthRequest, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential' });
    if (!googleClientId) {
      return res.status(500).json({ error: 'Google auth is not configured on server' });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: 'Invalid Google token' });

    const { email, given_name, family_name, sub, picture } = payload;
    if (!email) return res.status(401).json({ error: 'Invalid Google token' });

    let user = await findUserByEmail(email);

    if (!user) {
      user = await createUser({
        email,
        firstName: given_name || 'Google',
        lastName: family_name || 'User',
        googleId: sub,
        profileImage: picture ?? null,
        status: 'active',
        isActive: true,
        city: 'Not Set',
        state: 'Not Set',
        country: 'Not Set',
        role: 'user',
      });
    } else if (!user.googleId || !user.profileImage) {
      user = (await updateUserById(formatUserId(user), {
        googleId: user.googleId ?? sub,
        profileImage: user.profileImage ?? picture ?? null,
      }))!;
    }

    const token = generateToken(formatUserId(user), user.email, user.role);
    clearAuthCookie(res);
    setAuthCookie(res, token);
    res.json({
      message: 'Google login successful',
      token,
      user: formatUserForAuth(user),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorDetails = logger.error('googleLogin', error, {
      method: req.method,
      path: req.path,
      userId: req.user?.userId,
    });

    let hint: string | undefined;
    if (!googleClientId) {
      hint = 'Set GOOGLE_CLIENT_ID in Azure Static Web App environment variables';
    } else if (message.toLowerCase().includes('audience')) {
      hint = 'GOOGLE_CLIENT_ID on API must match VITE_GOOGLE_CLIENT_ID in frontend build';
    } else if (message.includes('MongoServerSelectionError') || message.includes('ETIMEOUT')) {
      hint = 'Check MONGODB_URI and Atlas network access';
    }

    res.status(errorDetails.statusCode || 500).json({
      error: 'Google login failed',
      ...(hint ? { hint } : {}),
      ...(process.env.NODE_ENV === 'development' ? { details: message } : {}),
    });
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(formatUserProfile(user));
  } catch (error) {
    const errorDetails = logger.error('getUserProfile', error, {
      method: req.method,
      path: req.path,
      userId: req.user?.userId,
    });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to get profile' });
  }
};

export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const body = (req as AuthRequest & { validatedBody?: Record<string, unknown> }).validatedBody ?? req.body;
    const { phoneNumber, city, state, country } = body;

    if (phoneNumber !== undefined && !String(phoneNumber).trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await updateUserById(userId, {
      ...(phoneNumber !== undefined ? { phoneNumber: phoneNumber || null } : {}),
      ...(city !== undefined ? { city: city ? capitalizeProperNoun(String(city)) : '' } : {}),
      ...(state !== undefined ? { state: state ? capitalizeProperNoun(String(state)) : '' } : {}),
      ...(country !== undefined ? { country: country ? capitalizeProperNoun(String(country)) : '' } : {}),
    });

    res.json({
      message: 'Profile updated successfully',
      user: formatUserForAuth(updated!),
    });
  } catch (error) {
    const errorDetails = logger.error('updateUserProfile', error, {
      method: req.method,
      path: req.path,
      userId: req.user?.userId,
    });
    res.status(errorDetails.statusCode || 500).json({ error: 'Failed to update profile' });
  }
};
