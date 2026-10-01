import express from 'express';
import { computeRoute, computeReroute, getNearbyNavChargers } from '../controllers/navigationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/route', computeRoute);
router.post('/reroute', computeReroute);
router.get('/nearby-chargers', getNearbyNavChargers);

export default router;
