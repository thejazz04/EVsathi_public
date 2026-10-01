import express from 'express';
import {
  createReview,
  updateReview,
  deleteReview,
  getChargerReviews,
  getUserReviews,
} from '../controllers/reviewController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);
router.get('/charger/:chargerId', getChargerReviews);
router.get('/user/:userId', getUserReviews);

export default router;
