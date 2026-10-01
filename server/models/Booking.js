import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    charger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Charger',
      required: true,
      index: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Slot',
      default: null,
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'pending', 'confirmed', 'completed', 'cancelled'],
      default: 'PENDING_PAYMENT',
      index: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    // Immutable Price Snapshot created at booking reservation time
    pricingSnapshot: {
      pricePerHour: { type: Number },
      pricePerKwh: { type: Number },
      surgeMultiplier: { type: Number, default: 1.0 },
      appliedRules: [{ type: String }],
      calculatedAt: { type: Date, default: Date.now },
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PENDING', 'PAID', 'REFUNDED', 'FAILED'],
      default: 'UNPAID',
    },
    paymentOrderId: {
      type: String,
      default: '',
    },
    paymentReceiptId: {
      type: String,
      default: '',
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true, // Non-destructive expiration timestamp checked by background job
    },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes for Concurrency Checks & Fast Query Performance
bookingSchema.index({ charger: 1, startTime: 1, endTime: 1, status: 1 });
bookingSchema.index({ status: 1, expiresAt: 1 });

// CRITICAL: Pre-save validation to prevent overlapping bookings
// This is a last-resort database-level check
bookingSchema.pre('save', async function (next) {
  // Only check for new bookings or if times are modified
  if (!this.isNew && !this.isModified('startTime') && !this.isModified('endTime')) {
    return next();
  }

  // Skip check for cancelled/completed bookings
  const statusUpper = (this.status || '').toUpperCase();
  if (['CANCELLED', 'COMPLETED', 'EXPIRED'].includes(statusUpper)) {
    return next();
  }

  try {
    // Check for overlapping bookings at the same charger
    const overlap = await this.constructor.findOne({
      _id: { $ne: this._id }, // Exclude current booking
      charger: this.charger,
      status: { $in: ['PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'confirmed', 'active', 'pending'] },
      $or: [
        // Case 1: Overlap at start
        { startTime: { $lt: this.endTime }, endTime: { $gt: this.startTime } },
        // Case 2: New booking contains existing
        { startTime: { $gte: this.startTime }, endTime: { $lte: this.endTime } },
        // Case 3: Existing booking contains new
        { startTime: { $lte: this.startTime }, endTime: { $gte: this.endTime } },
      ],
    });

    if (overlap) {
      const err = new Error('Booking time slot conflicts with an existing reservation');
      err.code = 'BOOKING_OVERLAP_DETECTED';
      return next(err);
    }

    next();
  } catch (err) {
    next(err);
  }
});

export const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
