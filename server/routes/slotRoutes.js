import express from 'express';
import {
  getHostSlots,
  getDriverSlots,
  blockTimeSlot,
  unblockTimeSlot,
  updateBlockedSlot,
  generateAvailableSlots,
  getSlotGrid,
} from '../controllers/slotController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router({ mergeParams: true });

// PUBLIC ROUTES: Slot grid for charger detail pages
router.get('/grid', getSlotGrid);

// DRIVER ROUTES: Read-only Gantt chart view
router.get('/driver/:chargerId', getDriverSlots);

// HOST ROUTES: Full Gantt chart management
router.get('/host/:chargerId', protect, authorize('HOST'), getHostSlots);
router.post('/host/:chargerId/block', protect, authorize('HOST'), blockTimeSlot);
router.delete('/host/:slotId/unblock', protect, authorize('HOST'), unblockTimeSlot);
router.put('/host/:slotId', protect, authorize('HOST'), updateBlockedSlot);
router.post('/host/:chargerId/generate', protect, authorize('HOST'), generateAvailableSlots);

export default router;
