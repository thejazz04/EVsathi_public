import Booking from '../../models/Booking.js';
import Slot from '../../models/Slot.js';
import logger from '../../utils/logger.js';

let expiryInterval = null;

/**
 * Non-destructive background job to transition expired PENDING_PAYMENT bookings to EXPIRED
 * and release associated reserved slots
 */
export const startBookingExpiryJob = () => {
  if (expiryInterval) return;

  expiryInterval = setInterval(async () => {
    try {
      const now = new Date();
      const expiredBookings = await Booking.find({
        status: { $in: ['PENDING_PAYMENT', 'pending'] },
        expiresAt: { $lt: now },
      }).select('_id slot');

      if (expiredBookings.length > 0) {
        const expiredIds = expiredBookings.map((b) => b._id);
        const slotIds = expiredBookings.map((b) => b.slot).filter(Boolean);

        await Booking.updateMany(
          { _id: { $in: expiredIds } },
          { $set: { status: 'EXPIRED' } }
        );

        // Release associated slots back to available
        await Slot.updateMany(
          {
            $or: [
              { _id: { $in: slotIds } },
              { booking: { $in: expiredIds } },
            ],
          },
          { $set: { status: 'available', booking: null } }
        );

        logger.info(
          `Booking Expiry Job: Transitioned ${expiredBookings.length} expired pending reservations to EXPIRED and released slots.`
        );
      }
    } catch (err) {
      logger.error('Error running booking expiry background job', { error: err.message });
    }
  }, 60000); // Runs every 60s
};

export const stopBookingExpiryJob = () => {
  if (expiryInterval) {
    clearInterval(expiryInterval);
    expiryInterval = null;
  }
};
