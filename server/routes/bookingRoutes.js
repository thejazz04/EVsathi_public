import express from 'express';
import {
  createBooking,
  getBookings,
  getBookingById,
  cancelBooking,
  checkIn,
  checkOut,
  getUpcomingBookings,
  getPastBookings,
  getMyRentals,
} from '../controllers/bookingController.js';
import { protect } from '../middleware/authMiddleware.js';
import { createBookingSchema } from '../validators/bookingValidator.js';
import { validateRequest } from '../validators/authValidator.js';

const router = express.Router();

router.use(protect);

router.post('/', validateRequest(createBookingSchema), createBooking);
router.get('/', getBookings);
router.get('/upcoming', getUpcomingBookings);
router.get('/past', getPastBookings);
router.get('/my-rentals', getMyRentals);
router.get('/:id', getBookingById);
router.put('/:id/cancel', cancelBooking);
router.put('/:id/checkin', checkIn);
router.put('/:id/checkout', checkOut);

export default router;
