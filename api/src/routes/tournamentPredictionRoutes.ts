import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateRequest, schemas } from '../utils/validation';
import * as tournamentPredictionController from '../controllers/tournamentPredictionController';

const router = Router();

router.get('/', authMiddleware, tournamentPredictionController.getTournamentPrediction);
router.get('/community', authMiddleware, tournamentPredictionController.getCommunityTournamentPredictions);
router.get('/user/:userId', authMiddleware, tournamentPredictionController.getUserTournamentPrediction);
router.post(
  '/',
  authMiddleware,
  validateRequest(schemas.tournamentPrediction),
  tournamentPredictionController.submitTournamentPrediction
);
router.put(
  '/',
  authMiddleware,
  validateRequest(schemas.tournamentPrediction),
  tournamentPredictionController.submitTournamentPrediction
);

export default router;
