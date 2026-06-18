import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { validateRequest, schemas } from '../utils/validation';
import * as matchController from '../controllers/matchController';

const router = Router();

// Public routes
router.get('/', matchController.getAllMatches);
router.get('/teams', matchController.getAllTeams);
router.get('/latest-completed/top-earners', matchController.getLatestCompletedMatchTopEarners);
router.get('/live/predictions', authMiddleware, matchController.getLiveMatchPredictions);
router.get('/:matchId', matchController.getMatchById);

// Admin routes
router.post('/', authMiddleware, adminMiddleware, validateRequest(schemas.match), matchController.createMatch);

router.put('/:matchId', authMiddleware, adminMiddleware, matchController.updateMatch);
router.delete('/:matchId', authMiddleware, adminMiddleware, matchController.deleteMatch);

export default router;
