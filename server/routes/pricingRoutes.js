import express from 'express';
import { getPricingInfo } from '../controllers/pricingController.js';

const router = express.Router();

router.get('/:chargerId/pricing', getPricingInfo);
router.get('/info/:chargerId', getPricingInfo);

export default router;
