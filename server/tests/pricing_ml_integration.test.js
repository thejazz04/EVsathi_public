import dotenv from 'dotenv';
dotenv.config();
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import Charger from '../models/Charger.js';
import Pricing from '../models/Pricing.js';
import Booking from '../models/Booking.js';
import Slot from '../models/Slot.js';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';
import { getPrice } from '../services/pricing/pricing.service.js';
import { resolveCalibrationStationId } from '../services/ml/demand.service.js';
import { createBookingWithConcurrencyGuard } from '../services/booking/booking.service.js';

describe('EVsathi Phase 9 — XGBoost Demand Prediction → Pricing Integration Tests', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  let testCharger;
  let testDriver;
  let testHost;

  beforeAll(async () => {
    await connectDB();

    // Create persistent test entities if they don't already exist
    testHost = await User.findOne({ email: 'phase9_host_test@evsathi.internal' });
    if (!testHost) {
      testHost = await User.create({
        name: 'Phase 9 Host',
        email: 'phase9_host_test@evsathi.internal',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv1234567890abcdefghijklmnopqrstu',
        role: 'HOST',
        phone: '+919876543210',
      });
    }

    testDriver = await User.findOne({ email: 'phase9_driver_test@evsathi.internal' });
    if (!testDriver) {
      testDriver = await User.create({
        name: 'Phase 9 Driver',
        email: 'phase9_driver_test@evsathi.internal',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv1234567890abcdefghijklmnopqrstu',
        role: 'DRIVER',
        phone: '+919876543211',
      });
    }

    testCharger = await Charger.findOne({ title: 'CHG-NCR-001' });
    if (!testCharger) {
      testCharger = await Charger.create({
        title: 'CHG-NCR-001',
        owner: testHost._id,
        pricePerHour: 30,
        pricePerKwh: 15,
        chargerType: 'DC_FAST',
        powerOutput: 50,
        isActive: false,
        location: {
          address: 'Sector 62, Noida',
          city: 'Noida',
          state: 'Uttar Pradesh',
          zipCode: '201301',
          coordinates: [77.36, 28.62],
        },
      });
    }

    let testPricing = await Pricing.findOne({ charger: testCharger._id });
    if (!testPricing) {
      await Pricing.create({
        charger: testCharger._id,
        basePricePerHour: 30,
        basePricePerKwh: 15,
        surgeMultiplierWeight: 0.5,
        weekendMultiplier: 1.2,
        holidayMultiplier: 1.3,
        pricingAlgorithm: 'RULE_BASED_PRICING',
      });
    }
  }, 20000);

  afterAll(async () => {
    process.env = originalEnv;
    global.fetch = originalFetch;

    // Clean up test bookings and test charger
    await Booking.deleteMany({ driver: testDriver?._id });
    if (testCharger?._id) {
      await Booking.deleteMany({ charger: testCharger._id });
      await Slot.deleteMany({ charger: testCharger._id });
      await Pricing.deleteMany({ charger: testCharger._id });
      await Charger.deleteOne({ _id: testCharger._id });
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('1. Case A: ML Enabled + Online FastAPI Integration', () => {
    it('consumes predictedDemand as an advisory signal and applies bounded surge', async () => {
      process.env.ML_ENABLED = 'true';

      // Mock successful FastAPI response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          charger_id: 'CHG-NCR-001',
          timestamp: '2024-11-07 14:00:00',
          model_version: 'xgboost_demand_v1',
          model_name: 'XGBoost Demand Model v1 — Synthetic Benchmark',
          forecast_type: 'rolling_one_step_ahead',
          predicted_demand: 0.74,
          features_used: { hour: 14, is_fast_charger: 1.0 },
          disclaimer: 'calibrated synthetic benchmark',
        }),
      });

      const targetTime = new Date(2024, 10, 7, 14, 0, 0); // 14:00 local time
      const result = await getPrice({
        chargerId: testCharger._id,
        startTime: targetTime,
      });

      // Verification
      expect(result.pricingAlgorithm).toBe('XGBOOST_ADVISORY_RULE_BASED');
      expect(result.mlStatus).toBe('ACTIVE');
      expect(result.predictedDemand).toBe(0.74);
      expect(result.modelVersion).toBe('xgboost_demand_v1');
      expect(result.fallbackReason).toBeNull();

      // Mapping: 1.0 + 2.0 * (0.74 - 0.50) = 1.48 (within [0.8, 1.5])
      expect(result.demandFactor).toBe(1.48);

      // SurgeComponent = 1 + 0.5 * (1.48 - 1.0) = 1.24
      expect(result.demandMultiplier).toBe(1.24);

      // Base = 30. Local Hour 14 (1.0 time multiplier). Non-holiday (1.0).
      // Price = 30 * 1.24 * 1.0 * 1.0 = 37.2 -> 37
      expect(result.recommendedPrice).toBe(37);
      expect(result.basePrice).toBe(30);
    });

  });

  describe('2. Case B: ML Disabled (ML_ENABLED=false)', () => {
    it('smoothly reverts to deterministic rule-based pricing with mlStatus FALLBACK', async () => {
      process.env.ML_ENABLED = 'false';

      const result = await getPrice({
        chargerId: testCharger._id,
        startTime: '2024-11-07T14:00:00.000Z',
      });

      expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
      expect(result.mlStatus).toBe('FALLBACK');
      expect(result.fallbackReason).toBe('ML_SERVICE_DISABLED');
      expect(result.predictedDemand).toBeNull();
      expect(result.modelVersion).toBeNull();
      expect(result.basePrice).toBe(30);
      expect(result.recommendedPrice).toBeGreaterThanOrEqual(15);
      expect(result.recommendedPrice).toBeLessThanOrEqual(60);
    });
  });

  describe('3. Case C & D: FastAPI Offline & Timeout Fallback', () => {
    it('handles unreachable FastAPI service by gracefully falling back', async () => {
      process.env.ML_ENABLED = 'true';
      global.fetch = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8000'));

      const result = await getPrice({
        chargerId: testCharger._id,
        startTime: '2024-11-07T14:00:00.000Z',
      });

      expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
      expect(result.mlStatus).toBe('FALLBACK');
      expect(result.fallbackReason).toBe('ML_SERVICE_UNAVAILABLE');
      expect(result.predictedDemand).toBeNull();
    });

    it('handles request timeout (>5000ms AbortError) by gracefully falling back', async () => {
      process.env.ML_ENABLED = 'true';
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = jest.fn().mockRejectedValue(abortError);

      const result = await getPrice({
        chargerId: testCharger._id,
        startTime: '2024-11-07T14:00:00.000Z',
      });

      expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
      expect(result.mlStatus).toBe('FALLBACK');
      expect(result.fallbackReason).toBe('ML_SERVICE_TIMEOUT');
      expect(result.predictedDemand).toBeNull();
    });
  });

  describe('4. Case E & F: FastAPI Error Status & Malformed Output Fallback', () => {
    it('handles HTTP 500 internal ML error with rule-based fallback', async () => {
      process.env.ML_ENABLED = 'true';
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal XGBoost inference failure',
      });

      const result = await getPrice({
        chargerId: testCharger._id,
        startTime: '2024-11-07T14:00:00.000Z',
      });

      expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
      expect(result.mlStatus).toBe('FALLBACK');
      expect(result.fallbackReason).toBe('ML_INTERNAL_ERROR');
    });

    it('handles malformed output (NaN or out-of-bounds demand) with rule-based fallback', async () => {
      process.env.ML_ENABLED = 'true';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          charger_id: 'CHG-NCR-001',
          predicted_demand: 'not-a-number', // Malformed
          model_version: 'xgboost_demand_v1',
          features_used: {},
        }),
      });

      const result = await getPrice({
        chargerId: testCharger._id,
        startTime: '2024-11-07T14:00:00.000Z',
      });

      expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
      expect(result.mlStatus).toBe('FALLBACK');
    });
  });

  describe('5. Case G: Authoritative Metro Station Mappings', () => {
    it('resolves Mumbai, Hyderabad, and Pune chargers to authoritative station IDs', async () => {
      // Mumbai -> CHG-MUM-007
      const mumStation = await resolveCalibrationStationId(null, 19.06, 72.87);
      expect(mumStation).toBe('CHG-MUM-007');

      // Hyderabad -> CHG-HYD-010
      const hydStation = await resolveCalibrationStationId(null, 17.44, 78.38);
      expect(hydStation).toBe('CHG-HYD-010');

      // Pune -> CHG-PUN-009
      const punStation = await resolveCalibrationStationId(null, 18.53, 73.85);
      expect(punStation).toBe('CHG-PUN-009');
    });
  });

  describe('6. Case H: Price Safety Boundaries', () => {
    it('clamps prices so they never drop below 0.5x base or exceed 2.0x base', async () => {
      // Base is 30. Bounds: [15, 60]
      // Extreme low demand: 0.05 -> factor 0.80 -> night discount 0.8
      // Price: 30 * (1 + 0.5*(0.8-1.0)) * 0.8 = 30 * 0.9 * 0.8 = 21.6 -> 22 (safe >= 15)
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          charger_id: 'CHG-NCR-001',
          timestamp: '2024-11-07 03:00:00',
          predicted_demand: 0.05,
          model_version: 'xgboost_demand_v1',
          features_used: {},
        }),
      });

      const lowResult = await getPrice({
        chargerId: testCharger._id,
        startTime: new Date(2024, 10, 7, 3, 0, 0), // 03:00 local time
      });
      expect(lowResult.recommendedPrice).toBeGreaterThanOrEqual(15);
      expect(lowResult.recommendedPrice).toBeLessThanOrEqual(60);

      // Extreme high demand: 0.98 -> clamped factor 1.50 -> peak evening 1.25 -> holiday 1.3
      // Raw: 30 * (1 + 0.5*0.5) * 1.25 * 1.3 = 30 * 1.25 * 1.25 * 1.3 = 60.94 -> clamped to 60
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          charger_id: 'CHG-NCR-001',
          timestamp: '2024-11-07 19:00:00',
          predicted_demand: 0.98,
          model_version: 'xgboost_demand_v1',
          features_used: {},
        }),
      });

      const highResult = await getPrice({
        chargerId: testCharger._id,
        startTime: new Date(2024, 10, 7, 19, 0, 0), // 19:00 local time
        isHoliday: true,
      });
      expect(highResult.recommendedPrice).toBe(60); // Clamped at 2.0x base
      expect(highResult.demandFactor).toBe(1.50); // Clamped at 1.5
    });

  });

  describe('7. Case I: Booking Flow & Immutable Price Snapshot Safety', () => {
    it('creates booking with snapshot that remains permanent and immutable', async () => {
      // Mock active ML for booking
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          charger_id: 'CHG-NCR-001',
          timestamp: '2024-11-07 10:00:00',
          predicted_demand: 0.60,
          model_version: 'xgboost_demand_v1',
          features_used: {},
        }),
      });

      const startTime = new Date(Date.now() + 3600 * 1000);
      const endTime = new Date(startTime.getTime() + 2 * 3600 * 1000); // 2 hours

      const booking = await createBookingWithConcurrencyGuard({
        driverId: testDriver._id,
        chargerId: testCharger._id,
        startTime,
        endTime,
      });

      expect(booking).toBeDefined();
      expect(booking.pricingSnapshot).toBeDefined();
      expect(booking.pricingSnapshot.pricePerHour).toBeDefined();
      expect(booking.pricingSnapshot.appliedRules).toContain('XGBOOST_ADVISORY_RULE_BASED');

      const savedSnapshot = { ...booking.pricingSnapshot.toObject() };
      const savedTotalPrice = booking.totalPrice;

      // Verify that even if ML service later changes or becomes unavailable, the booking stays unchanged
      process.env.ML_ENABLED = 'false';
      const reloadedBooking = await Booking.findById(booking._id);
      expect(reloadedBooking.totalPrice).toBe(savedTotalPrice);
      expect(reloadedBooking.pricingSnapshot.pricePerHour).toBe(savedSnapshot.pricePerHour);
      expect(reloadedBooking.pricingSnapshot.surgeMultiplier).toBe(savedSnapshot.surgeMultiplier);
    });
  });
});
