import mongoose from 'mongoose';

/**
 * DemandData Model — Phase 6.5 Provenance & Observational Schema
 *
 * Stores hourly aggregated demand observations with explicit data provenance,
 * measurement taxonomy, and data-quality status.
 *
 * Provenance Classes:
 * - REAL_OBSERVATION: Direct hardware measurement from physical meters/chargers (e.g. OCPP).
 * - DERIVED_FROM_REAL: Aggregated from real operational user bookings/app charging sessions.
 * - SYNTHETIC_CALIBRATED: Derived from reference-grounded simulation calibration.
 * - SYNTHETIC_GENERATED: Pure synthetic benchmark data.
 */
const demandDataSchema = new mongoose.Schema(
  {
    charger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Charger',
      required: true,
      index: true,
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    hour: { type: Number, required: true, min: 0, max: 23 },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    month: { type: Number, required: true, min: 1, max: 12 },
    isWeekend: { type: Boolean, default: false },
    isHoliday: { type: Boolean, default: false },

    // Grid and Tariff Context
    electricityTariff: { type: Number, default: 8.5 },
    gridCondition: { type: String, default: 'Optimal' },

    // Operational Telemetry Aggregations
    activeBookings: { type: Number, default: 0, min: 0 },
    completedSessions: { type: Number, default: 0, min: 0 },
    occupancyRate: { type: Number, default: 0, min: 0, max: 1 },
    energyConsumed: { type: Number, default: 0, min: 0 }, // Energy in kWh

    // Observational Demand Value (Explicitly provided; ZERO fake 0.5 default)
    demandValue: {
      type: Number,
      required: false,
    },

    // Provenance & Quality Governance Fields
    provenance: {
      type: String,
      enum: ['REAL_OBSERVATION', 'DERIVED_FROM_REAL', 'SYNTHETIC_CALIBRATED', 'SYNTHETIC_GENERATED'],
      default: 'DERIVED_FROM_REAL',
      index: true,
    },
    measurementType: {
      type: String,
      enum: ['ENERGY_KWH', 'SESSION_COUNT', 'OCCUPANCY_MINUTES', 'SYNTHETIC_INDEX'],
      default: 'ENERGY_KWH',
    },
    telemetrySource: {
      type: String,
      enum: ['PHYSICAL_OCPP', 'IOT_GATEWAY', 'APP_VERIFIED_SESSION', 'CALIBRATED_SIMULATION', 'MOCK'],
      default: 'APP_VERIFIED_SESSION',
    },
    qualityStatus: {
      type: String,
      enum: ['VALID', 'INVALID', 'QUARANTINED'],
      default: 'VALID',
      index: true,
    },
    qualityFlags: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

demandDataSchema.index({ charger: 1, timestamp: -1, qualityStatus: 1 });
demandDataSchema.index({ charger: 1, provenance: 1, timestamp: -1 });

export const DemandData = mongoose.model('DemandData', demandDataSchema);
export default DemandData;
