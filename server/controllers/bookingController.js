import Booking from '../models/Booking.js';
import Slot from '../models/Slot.js';
import { createBookingWithConcurrencyGuard } from '../services/booking/booking.service.js';

/**
 * Verify that the authenticated user is authorized to access this booking.
 * A user is authorized if they are:
 * - The driver who made the booking, OR
 * - The host who owns the charger
 */
const verifyBookingOwnership = (booking, userId) => {
  const driverId = booking.driver?._id?.toString() || booking.driver?.toString();
  const hostId = booking.host?._id?.toString() || booking.host?.toString();
  const userIdStr = userId.toString();

  return driverId === userIdStr || hostId === userIdStr;
};

export const createBooking = async (req, res, next) => {
  try {
    const { chargerId, slotId, startTime, endTime } = req.body;

    const booking = await createBookingWithConcurrencyGuard({
      driverId: req.user._id,
      chargerId,
      slotId,
      startTime,
      endTime,
    });

    const populated = await Booking.findById(booking._id).populate('charger').populate('host', 'name email phone');

    res.status(201).json({
      success: true,
      data: { booking: populated },
    });
  } catch (error) {
    if (error.message.includes('already reserved')) {
      return res.status(409).json({
        success: false,
        error: { code: 'BOOKING_CONFLICT', message: error.message },
      });
    }
    next(error);
  }
};

export const getBookings = async (req, res, next) => {
  try {
    const { type, status } = req.query;
    const isOwnerQuery = type === 'rentals' || req.user.role === 'owner' || req.user.role === 'HOST';

    const query = isOwnerQuery ? { host: req.user._id } : { driver: req.user._id };
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('charger')
      .populate('driver', 'name email phone avatar')
      .populate('host', 'name email phone avatar')
      .sort({ startTime: -1 });

    res.status(200).json({
      success: true,
      data: { bookings },
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('charger')
      .populate('driver', 'name email phone avatar')
      .populate('host', 'name email phone avatar');

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      });
    }

    // Authorization: User must be the driver OR the host
    if (!verifyBookingOwnership(booking, req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not authorized to view this booking' },
      });
    }

    res.status(200).json({
      success: true,
      data: { booking },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      });
    }

    // Authorization: User must be the driver OR the host
    if (!verifyBookingOwnership(booking, req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not authorized to cancel this booking' },
      });
    }

    // Business rule: Cannot cancel already completed or cancelled bookings
    if (['COMPLETED', 'CANCELLED', 'completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Cannot cancel booking with status ${booking.status}` },
      });
    }

    booking.status = 'CANCELLED';
    booking.cancellationReason = reason || 'Cancelled by user';
    await booking.save();

    // Release any associated slot back to available
    await Slot.updateMany(
      {
        $or: [
          { _id: booking.slot },
          { booking: booking._id },
        ],
      },
      { $set: { status: 'available', booking: null } }
    );

    res.status(200).json({
      success: true,
      data: { booking },
    });
  } catch (error) {
    next(error);
  }
};

export const checkIn = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      });
    }

    // Authorization: User must be the driver OR the host
    if (!verifyBookingOwnership(booking, req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not authorized to check in this booking' },
      });
    }

    // Business rule: Can only check in CONFIRMED bookings
    if (!['CONFIRMED', 'confirmed', 'PENDING_PAYMENT', 'pending'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Cannot check in booking with status ${booking.status}` },
      });
    }

    booking.status = 'ACTIVE';
    await booking.save();

    res.status(200).json({
      success: true,
      data: { booking },
    });
  } catch (error) {
    next(error);
  }
};

export const checkOut = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      });
    }

    // Authorization: User must be the driver OR the host
    if (!verifyBookingOwnership(booking, req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not authorized to check out this booking' },
      });
    }

    // Business rule: Can only check out ACTIVE bookings
    if (booking.status !== 'ACTIVE' && booking.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Cannot check out booking with status ${booking.status}` },
      });
    }

    booking.status = 'COMPLETED';
    await booking.save();

    res.status(200).json({
      success: true,
      data: { booking },
    });
  } catch (error) {
    next(error);
  }
};

export const getUpcomingBookings = async (req, res, next) => {
  try {
    const now = new Date();
    const bookings = await Booking.find({
      driver: req.user._id,
      startTime: { $gte: now },
      status: { $in: ['CONFIRMED', 'PENDING_PAYMENT', 'confirmed', 'pending'] },
    })
      .populate('charger')
      .sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      data: { bookings },
    });
  } catch (error) {
    next(error);
  }
};

export const getPastBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({
      driver: req.user._id,
      status: { $in: ['COMPLETED', 'CANCELLED', 'EXPIRED', 'completed', 'cancelled'] },
    })
      .populate('charger')
      .sort({ startTime: -1 });

    res.status(200).json({
      success: true,
      data: { bookings },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyRentals = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ host: req.user._id })
      .populate('charger')
      .populate('driver', 'name email phone avatar')
      .sort({ startTime: -1 });

    res.status(200).json({
      success: true,
      data: { bookings },
    });
  } catch (error) {
    next(error);
  }
};
