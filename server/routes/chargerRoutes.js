import express from 'express';
import {
  getAllChargers,
  searchChargers,
  getChargerById,
  createCharger,
  updateCharger,
  deleteCharger,
  getMyChargers,
  checkAvailability,
  disableCharger,
  getChargerEarnings,
  getMyEarningsSummary,
} from '../controllers/chargerController.js';
import { getPricingInfo } from '../controllers/pricingController.js';
import slotRoutes from './slotRoutes.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { createChargerSchema } from '../validators/chargerValidator.js';
import { validateRequest } from '../validators/authValidator.js';

const router = express.Router();

// Mount Slot Routes under /api/chargers/:id/slots
router.use('/:id/slots', slotRoutes);

router.get('/', getAllChargers);
router.get('/search', searchChargers);
router.get('/my-chargers', protect, authorize('HOST'), getMyChargers);
router.get('/my-earnings', protect, authorize('HOST'), getMyEarningsSummary);
router.get('/:id', getChargerById);
router.get('/:id/pricing', getPricingInfo);
router.get('/:id/availability', checkAvailability);
router.get('/:id/earnings', protect, authorize('HOST'), getChargerEarnings);

router.post('/', protect, authorize('HOST'), validateRequest(createChargerSchema), createCharger);
router.put('/:id', protect, authorize('HOST'), updateCharger);
router.delete('/:id', protect, authorize('HOST'), deleteCharger);
router.post('/:id/disable', protect, authorize('HOST'), disableCharger);

export default router;
