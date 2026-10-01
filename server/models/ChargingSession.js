import mongoose from 'mongoose';

const chargingSessionSchema = new mongoose.Schema(
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
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    energyConsumedKwh: {
      type: Number,
      default: 0,
    },
    pricePerKwh: {
      type: Number,
      default: 15,
    },
    totalCost: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['STARTED', 'CHARGING', 'COMPLETED', 'CANCELLED'],
      default: 'STARTED',
      index: true,
    },
    telemetryMode: {
      type: String,
      enum: ['SIMULATION', 'PHYSICAL_OCPP', 'IOT_GATEWAY'],
      default: 'SIMULATION',
    },
  },
  {
    timestamps: true,
  }
);

chargingSessionSchema.index({ driver: 1, charger: 1, status: 1 });

export const ChargingSession = mongoose.model('ChargingSession', chargingSessionSchema);
export default ChargingSession;
