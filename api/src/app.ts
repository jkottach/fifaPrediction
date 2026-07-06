import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { applyPreParsedBody, jsonUnlessPreParsed } from './middleware/preParsedBody';
import { logger } from './lib/logger';
import { connectMongo, pingMongo } from './lib/mongodb';
import { SCORING_VERSION } from './services/scoringService';

import authRoutes from './routes/authRoutes';
import matchRoutes from './routes/matchRoutes';
import predictionRoutes from './routes/predictionRoutes';
import tournamentPredictionRoutes from './routes/tournamentPredictionRoutes';
import leaderboardRoutes from './routes/leaderboardRoutes';
import adminRoutes from './routes/adminRoutes';
import rolesRoutes from './routes/rolesRoutes';

/** Connect MongoDB once per process (Express dev server or Azure Functions worker). */
export async function initDatabase(): Promise<void> {
  await connectMongo();
}

/** Build the Express app without listening (used by local server and Azure Functions). */
export function buildApp(): Express {
  const app = express();

  // Required behind Azure Static Web Apps / Functions (X-Forwarded-For)
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(applyPreParsedBody);
  app.use(jsonUnlessPreParsed);
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api/') && res.statusCode < 400) {
        logger.info('apiSuccess', 'API request completed successfully', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Date.now() - start,
          ip: req.ip,
        });
      }
    });
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/health', async (_req, res) => {
    const mongo = await pingMongo();
    const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID?.trim());
    const jwtConfigured = Boolean(process.env.JWT_SECRET?.trim());
    const ok = mongo.ok && googleConfigured && jwtConfigured;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      runtime: 'express',
      scoringVersion: SCORING_VERSION,
      mongo,
      google: { configured: googleConfigured },
      jwt: { configured: jwtConfigured },
    });
  });

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  // Azure SWA rolesSource — must respond quickly; register before rate limiter
  app.use('/api', rolesRoutes);

  app.use('/api/', limiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/matches', matchRoutes);
  app.use('/api/predictions', predictionRoutes);
  app.use('/api/tournament-predictions', tournamentPredictionRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/admin', adminRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.path });
  });

  app.use(errorHandler);

  return app;
}

export async function startServer(): Promise<void> {
  await initDatabase();
  const app = buildApp();
  app.listen(config.server.port, () => {
    console.log(`✓ Server running on port ${config.server.port}`);
    console.log(`✓ Environment: ${config.server.nodeEnv}`);
  });
}

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

export default buildApp;
