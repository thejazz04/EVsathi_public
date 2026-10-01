import express from 'express';
import {
  getMlStatus,
  getDemandForecast,
  postDemandForecast,
  get24HourDemandForecast,
  getDynamicPricingEstimate,
} from '../controllers/mlController.js';

const router = express.Router();

router.get('/status', getMlStatus);
router.get('/demand/:chargerId/24hour', get24HourDemandForecast);
router.get('/demand/:chargerId', getDemandForecast);
router.get('/demand', getDemandForecast);
router.post('/demand', postDemandForecast);
router.post('/dynamic-pricing', getDynamicPricingEstimate);

export default router;
