import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, default: 2024 },
    batteryCapacityKwh: { type: Number, default: 60 },
    maxChargingRateKw: { type: Number, default: 50 },
    connectorTypes: [{ type: String, default: ['Type 2', 'CCS2'] }],
    licensePlate: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export default Vehicle;
