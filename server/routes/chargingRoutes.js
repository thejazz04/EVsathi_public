import express from 'express';
import {
  startSession,
  getActiveSession,
  stopSession,
  getSessionHistory,
} from '../controllers/chargingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/start', startSession);
router.get('/active', getActiveSession);
router.patch('/:id/stop', stopSession);
router.get('/history', getSessionHistory);

export default router;
