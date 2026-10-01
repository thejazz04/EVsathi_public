import mongoose from 'mongoose';

const slotSchema = new mongoose.Schema(
  {
    charger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Charger',
      required: true,
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'blocked'],
      default: 'available',
      index: true,
    },
    // For occupied slots - links to booking
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    // For blocked slots - host who blocked this slot
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Reason for blocking (maintenance, personal use, etc.)
    blockReason: {
      type: String,
      default: '',
    },
    // Notes for internal host reference
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
slotSchema.index({ charger: 1, startTime: 1, endTime: 1 });
slotSchema.index({ charger: 1, status: 1, startTime: 1 });

// PRE-SAVE VALIDATION: Prevent overlapping slots
slotSchema.pre('save', async function (next) {
  try {
    // Check for overlapping slots at the same charger
    const overlap = await this.constructor.findOne({
      _id: { $ne: this._id }, // Exclude current slot
      charger: this.charger,
      $or: [
        // Case 1: New slot starts during existing slot
        { startTime: { $lte: this.startTime }, endTime: { $gt: this.startTime } },
        // Case 2: New slot ends during existing slot
        { startTime: { $lt: this.endTime }, endTime: { $gte: this.endTime } },
        // Case 3: New slot completely contains existing slot
        { startTime: { $gte: this.startTime }, endTime: { $lte: this.endTime } },
        // Case 4: Existing slot completely contains new slot
        { startTime: { $lte: this.startTime }, endTime: { $gte: this.endTime } },
      ],
    });

    if (overlap) {
      const err = new Error('Slot time range overlaps with an existing slot');
      err.code = 'SLOT_OVERLAP_DETECTED';
      err.statusCode = 409;
      return next(err);
    }

    next();
  } catch (err) {
    next(err);
  }
});

// INSTANCE METHOD: Check if slot is editable by host
slotSchema.methods.isEditableByHost = function (hostId) {
  // Occupied slots (with bookings) cannot be edited
  if (this.status === 'occupied' && this.booking) {
    return false;
  }
  // Available and blocked slots can be edited by the charger owner
  return true;
};

// STATIC METHOD: Get Gantt chart data for a charger
slotSchema.statics.getGanttChartData = async function (chargerId, startDate, endDate) {
  const slots = await this.find({
    charger: chargerId,
    startTime: { $lt: new Date(endDate) },
    endTime: { $gt: new Date(startDate) },
  })
    .populate('booking', 'driver status')
    .populate('blockedBy', 'name email')
    .sort({ startTime: 1 });

  return slots.map((slot) => ({
    id: slot._id,
    startTime: slot.startTime,
    endTime: slot.endTime,
    status: slot.status,
    price: slot.price,
    booking: slot.booking,
    blockedBy: slot.blockedBy,
    blockReason: slot.blockReason,
    notes: slot.notes,
    isEditable: slot.status !== 'occupied',
  }));
};

export const Slot = mongoose.model('Slot', slotSchema);
export default Slot;
