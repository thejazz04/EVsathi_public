import Booking from '../../models/Booking.js';
import Charger from '../../models/Charger.js';
import Slot from '../../models/Slot.js';
import mongoose from 'mongoose';
import { getPrice } from '../pricing/pricing.service.js';
import logger from '../../utils/logger.js';

/**
 * Concurrency-Safe Overlap Check & Booking Creation
 * Ensures two users CANNOT reserve the same charger & time slot simultaneously.
 * Uses MongoDB transactions for atomic operations.
 */
export const createBookingWithConcurrencyGuard = async ({
  driverId,
  chargerId,
  slotId,
  startTime,
  endTime,
}) => {
  let targetSlot = null;
  let slotLocked = false;
  const session = await mongoose.startSession();

  try {
    // Start transaction for atomic operations
    await session.startTransaction();

    // 1. If slotId provided, validate and atomically reserve slot to prevent race conditions
    if (slotId) {
      if (!mongoose.Types.ObjectId.isValid(slotId)) {
        throw new Error('Invalid slot ID provided');
      }

      // Atomic reservation guard - this prevents race conditions
      targetSlot = await Slot.findOneAndUpdate(
        { _id: slotId, charger: chargerId, status: 'available' },
        { status: 'occupied' }, // Changed from 'reserved' to 'occupied'
        { new: true, session } // Use session for transaction
      );

      if (!targetSlot) {
        throw new Error('This slot is already reserved for the selected time');
      }

      slotLocked = true;
      if (!startTime) startTime = targetSlot.startTime;
      if (!endTime) endTime = targetSlot.endTime;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (!startTime || !endTime || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Valid start and end times are required for booking');
    }

    if (start >= end) {
      throw new Error('End time must be after start time');
    }

    const charger = await Charger.findById(chargerId).session(session);
    if (!charger || !charger.isActive) {
      throw new Error('Charger unavailable for booking');
    }

    // 2. CRITICAL: Overlap Check on live bookings (within transaction)
    // This prevents double-booking at the same charger for overlapping times
    const conflict = await Booking.findOne({
      charger: chargerId,
      status: { $in: ['PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'confirmed', 'active', 'pending'] },
      $or: [
        // Case 1: New booking starts during existing booking
        { startTime: { $lt: end }, endTime: { $gt: start } },
        // Case 2: New booking completely contains existing booking
        { startTime: { $gte: start }, endTime: { $lte: end } },
        // Case 3: Existing booking completely contains new booking
        { startTime: { $lte: start }, endTime: { $gte: end } },
      ],
    }).session(session);

    if (conflict) {
      throw new Error('This charger is already reserved for the selected time slot. Please choose a different time.');
    }

    // 3. Overlap Check on other occupied/blocked slots (if slotId not explicitly passed)
    if (!slotId) {
      const slotConflict = await Slot.findOne({
        charger: chargerId,
        status: { $in: ['occupied', 'blocked'] }, // Check both occupied and blocked slots
        $or: [
          { startTime: { $lt: end }, endTime: { $gt: start } },
          { startTime: { $gte: start }, endTime: { $lte: end } },
          { startTime: { $lte: start }, endTime: { $gte: end } },
        ],
      }).session(session);

      if (slotConflict) {
        throw new Error('This time slot is not available for booking');
      }
    }

    // 4. Price Calculation & Snapshot Creation
    const durationHours = Math.max(0.5, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
    const slotPrice = targetSlot?.price;

    let calculatedPricePerHour = charger.pricePerHour || 25;
    let surgeMultiplier = 1.0;
    const appliedRules = ['BASE_RATE'];

    if (!slotPrice) {
      try {
        const pricingInfo = await getPrice({
          chargerId,
          startTime: start,
          endTime: end,
        });
        if (pricingInfo && pricingInfo.recommendedPrice) {
          calculatedPricePerHour = pricingInfo.recommendedPrice;
          surgeMultiplier = pricingInfo.demandMultiplier || 1.0;
          if (pricingInfo.pricingAlgorithm) {
            appliedRules.push(pricingInfo.pricingAlgorithm);
          }
          if (pricingInfo.holidayMultiplier > 1.0) {
            appliedRules.push('HOLIDAY_SURGE');
          }
        }
      } catch (priceErr) {
        logger.warn('Failed to fetch dynamic price for booking, using base rate', {
          chargerId,
          error: priceErr.message,
        });
        appliedRules.push('FALLBACK_BASE_RATE');
      }
    }

    const totalPrice = slotPrice ? slotPrice : Math.round(durationHours * calculatedPricePerHour);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry for unpaid reservation

    // 5. Create booking within transaction
    const booking = await Booking.create([{
      driver: driverId,
      charger: chargerId,
      host: charger.owner,
      slot: targetSlot ? targetSlot._id : null,
      startTime: start,
      endTime: end,
      totalPrice,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      pricingSnapshot: {
        pricePerHour: calculatedPricePerHour,
        pricePerKwh: charger.pricePerKwh,
        surgeMultiplier,
        appliedRules,
        calculatedAt: new Date(),
      },
      expiresAt,
    }], { session });

    if (targetSlot) {
      targetSlot.booking = booking[0]._id;
      await targetSlot.save({ session });
    }

    // Commit transaction - all operations succeed or all fail
    await session.commitTransaction();
    
    logger.info('Booking created successfully with concurrency protection', {
      bookingId: booking[0]._id,
      chargerId,
      startTime: start,
      endTime: end,
    });

    return booking[0];
  } catch (err) {
    // Rollback transaction on any error
    await session.abortTransaction();
    
    // If we locked a slot but failed later in the process, roll it back to available
    if (slotLocked && targetSlot) {
      await Slot.findByIdAndUpdate(targetSlot._id, { status: 'available', booking: null });
    }
    
    logger.error('Booking creation failed', {
      error: err.message,
      chargerId,
      driverId,
    });
    
    throw err;
  } finally {
    // Always end session
    session.endSession();
  }
};

/**
 * Cancel a booking and release the slot back to available
 */
export const cancelBookingAndReleaseSlot = async (bookingId, reason = '') => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Update booking status
    booking.status = 'CANCELLED';
    booking.cancellationReason = reason;
    await booking.save({ session });

    // Release the slot if it exists
    if (booking.slot) {
      await Slot.findByIdAndUpdate(
        booking.slot,
        { 
          status: 'available', 
          booking: null 
        },
        { session }
      );
    }

    await session.commitTransaction();
    
    logger.info('Booking cancelled and slot released', {
      bookingId,
      slotId: booking.slot,
    });

    return booking;
  } catch (err) {
    await session.abortTransaction();
    logger.error('Failed to cancel booking', {
      bookingId,
      error: err.message,
    });
    throw err;
  } finally {
    session.endSession();
  }
};
