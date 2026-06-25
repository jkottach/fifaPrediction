import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateRequest, schemas } from '../utils/validation';
import * as predictionController from '../controllers/predictionController';

const router = Router();

// Protected routes
router.post('/', authMiddleware, validateRequest(schemas.prediction), predictionController.submitPrediction);
router.get('/', authMiddleware, predictionController.getUserPredictions);
router.get('/results/list', authMiddleware, predictionController.getUserPredictionsFromResults);
router.put('/:predictionId', authMiddleware, validateRequest(schemas.predictionUpdate), predictionController.updatePrediction);
router.delete('/:predictionId', authMiddleware, predictionController.deletePrediction);

export default router;
