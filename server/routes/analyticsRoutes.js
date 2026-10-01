import express from 'express';
import { getHostAnalytics, getDriverAnalytics } from '../controllers/analyticsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/host', getHostAnalytics);
router.get('/driver', getDriverAnalytics);

export default router;
