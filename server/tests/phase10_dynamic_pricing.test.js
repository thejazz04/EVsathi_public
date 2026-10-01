import dotenv from 'dotenv';
dotenv.config();
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';
import Charger from '../models/Charger.js';
import Pricing from '../models/Pricing.js';
import Booking from '../models/Booking.js';
import Slot from '../models/Slot.js';
import User from '../models/User.js';
import PricingHistory from '../models/PricingHistory.js';
import { connectDB } from '../config/db.js';
import { getPrice } from '../services/pricing/pricing.service.js';
import { createBookingWithConcurrencyGuard } from '../services/booking/booking.service.js';

describe('Phase 10: Demand-Aware Dynamic Pricing Comprehensive Test Suite', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  let testCharger;
  let testDriver;
  let testHost;

  beforeAll(async () => {
    await connectDB();

    testHost = await User.findOne({ email: 'phase10_host_test@evsathi.internal' });
    if (!testHost) {
      testHost = await User.create({
        name: 'Phase 10 Host',
        email: 'phase10_host_test@evsathi.internal',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv1234567890abcdefghijklmnopqrstu',
        role: 'HOST',
        phone: '+919876543220',
      });
    }

    testDriver = await User.findOne({ email: 'phase10_driver_test@evsathi.internal' });
    if (!testDriver) {
      testDriver = await User.create({
        name: 'Phase 10 Driver',
        email: 'phase10_driver_test@evsathi.internal',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv1234567890abcdefghijklmnopqrstu',
        role: 'DRIVER',
        phone: '+919876543221',
      });
    }

    testCharger = await Charger.findOne({ title: 'CHG-PHASE10-001' });
    if (!testCharger) {
      testCharger = await Charger.create({
        title: 'CHG-PHASE10-001',
        owner: testHost._id,
        pricePerHour: 40,
        pricePerKwh: 18,
        chargerType: 'DC_FAST',
        powerOutput: 60,
        isActive: false,
        location: {
          address: 'Cyber City, Gurugram',
          city: 'Gurugram',
          state: 'Haryana',
          zipCode: '122002',
          coordinates: [77.08, 28.49],
        },
      });
    }

    let testPricing = await Pricing.findOne({ charger: testCharger._id });
    if (!testPricing) {
      await Pricing.create({
        charger: testCharger._id,
        basePricePerHour: 40,
        basePricePerKwh: 18,
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

    await Booking.deleteMany({ driver: testDriver?._id });
    await PricingHistory.deleteMany({ charger: testCharger?._id });
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

  // 1. Low predicted demand
  it('1. Low predicted demand (0.05) produces bounded multiplier and lower price', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        timestamp: '2024-11-07 14:00:00',
        model_version: 'xgboost_demand_v1',
        predicted_demand: 0.05,
      }),
    });

    const targetTime = new Date(2024, 10, 7, 14, 0, 0); // 14:00 local
    const result = await getPrice({ chargerId: testCharger._id, startTime: targetTime });

    expect(result.predictedDemand).toBe(0.05);
    expect(result.demandFactor).toBe(0.80); // Clamped low factor
    expect(result.demandMultiplier).toBe(0.90); // 1 + 0.5 * (0.8 - 1.0) = 0.90
    expect(result.recommendedPrice).toBe(36); // 40 * 0.9 = 36
    expect(result.pricingAlgorithm).toBe('XGBOOST_ADVISORY_RULE_BASED');
  });

  // 2. Medium predicted demand
  it('2. Medium predicted demand (0.50) produces neutral 1.00 multiplier', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        timestamp: '2024-11-07 14:00:00',
        model_version: 'xgboost_demand_v1',
        predicted_demand: 0.50,
      }),
    });

    const targetTime = new Date(2024, 10, 7, 14, 0, 0);
    const result = await getPrice({ chargerId: testCharger._id, startTime: targetTime });

    expect(result.predictedDemand).toBe(0.50);
    expect(result.demandFactor).toBe(1.00);
    expect(result.demandMultiplier).toBe(1.00);
    expect(result.recommendedPrice).toBe(40);
  });

  // 3. High predicted demand
  it('3. High predicted demand (0.90) produces higher surge multiplier', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        timestamp: '2024-11-07 14:00:00',
        model_version: 'xgboost_demand_v1',
        predicted_demand: 0.90,
      }),
    });

    const targetTime = new Date(2024, 10, 7, 14, 0, 0);
    const result = await getPrice({ chargerId: testCharger._id, startTime: targetTime });

    expect(result.predictedDemand).toBe(0.90);
    expect(result.demandFactor).toBe(1.50); // Clamped high factor
    expect(result.demandMultiplier).toBe(1.25); // 1 + 0.5 * (1.5 - 1.0) = 1.25
    expect(result.recommendedPrice).toBe(50); // 40 * 1.25 = 50
  });

  // 4. Demand multiplier bounds
  it('4. Demand multiplier is strictly bounded within [0.80, 1.50] factor range', async () => {
    process.env.ML_ENABLED = 'true';
    // Extreme high demand 0.99
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        timestamp: '2024-11-07 14:00:00',
        model_version: 'xgboost_demand_v1',
        predicted_demand: 0.99,
      }),
    });

    const targetTime = new Date(2024, 10, 7, 14, 0, 0);
    const result = await getPrice({ chargerId: testCharger._id, startTime: targetTime });
    expect(result.demandFactor).toBeLessThanOrEqual(1.50);
    expect(result.demandFactor).toBeGreaterThanOrEqual(0.80);
  });

  // 5. Minimum price protection
  it('5. Price floor protection prevents price dropping below 0.5x base', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        timestamp: '2024-11-07 03:00:00', // Night off-peak 0.8x multiplier
        predicted_demand: 0.0,
      }),
    });

    const targetTime = new Date(2024, 10, 7, 3, 0, 0);
    const result = await getPrice({ chargerId: testCharger._id, startTime: targetTime });
    const minAllowed = Math.max(1, Math.round(40 * 0.5)); // 20
    expect(result.recommendedPrice).toBeGreaterThanOrEqual(minAllowed);
  });

  // 6. Maximum price protection
  it('6. Price ceiling protection clamps price at 2.0x base', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        timestamp: '2024-11-07 19:00:00', // Evening peak 1.25x
        predicted_demand: 1.0,
      }),
    });

    const targetTime = new Date(2024, 10, 7, 19, 0, 0);
    const result = await getPrice({ chargerId: testCharger._id, startTime: targetTime, isHoliday: true });
    const maxAllowed = Math.round(40 * 2.0); // 80
    expect(result.recommendedPrice).toBe(maxAllowed);
  });

  // 7. NaN predictedDemand protection
  it('7. Handles NaN predictedDemand by falling back to rule-based pricing', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        predicted_demand: NaN,
      }),
    });

    const result = await getPrice({ chargerId: testCharger._id });
    expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
    expect(result.mlStatus).toBe('FALLBACK');
  });

  // 8. Infinity predictedDemand protection
  it('8. Handles Infinity predictedDemand by falling back to rule-based pricing', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        predicted_demand: Infinity,
      }),
    });

    const result = await getPrice({ chargerId: testCharger._id });
    expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
    expect(result.mlStatus).toBe('FALLBACK');
  });

  // 9. predictedDemand < 0 handling
  it('9. Handles predictedDemand < 0 by falling back to rule-based pricing', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        predicted_demand: -0.25,
      }),
    });

    const result = await getPrice({ chargerId: testCharger._id });
    expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
    expect(result.mlStatus).toBe('FALLBACK');
  });

  // 10. predictedDemand > 1 handling
  it('10. Handles predictedDemand > 1 by falling back to rule-based pricing', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        predicted_demand: 1.5,
      }),
    });

    const result = await getPrice({ chargerId: testCharger._id });
    expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
    expect(result.mlStatus).toBe('FALLBACK');
  });

  // 11. ML disabled
  it('11. ML_ENABLED=false gracefully falls back to rule-based pricing', async () => {
    process.env.ML_ENABLED = 'false';
    const result = await getPrice({ chargerId: testCharger._id });

    expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
    expect(result.mlStatus).toBe('FALLBACK');
    expect(result.fallbackReason).toBe('ML_SERVICE_DISABLED');
  });

  // 12. FastAPI service unavailable
  it('12. Network failure (ECONNREFUSED) gracefully falls back to rule-based pricing', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8000'));

    const result = await getPrice({ chargerId: testCharger._id });
    expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
    expect(result.mlStatus).toBe('FALLBACK');
    expect(result.fallbackReason).toBe('ML_SERVICE_UNAVAILABLE');
  });

  // 13. FastAPI timeout
  it('13. FastAPI timeout (>5000ms AbortError) gracefully falls back', async () => {
    process.env.ML_ENABLED = 'true';
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortErr);

    const result = await getPrice({ chargerId: testCharger._id });
    expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
    expect(result.mlStatus).toBe('FALLBACK');
    expect(result.fallbackReason).toBe('ML_SERVICE_TIMEOUT');
  });

  // 14. FastAPI HTTP 500 error
  it('14. FastAPI HTTP 500 internal error gracefully falls back', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal XGBoost inference error',
    });

    const result = await getPrice({ chargerId: testCharger._id });
    expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
    expect(result.mlStatus).toBe('FALLBACK');
    expect(result.fallbackReason).toBe('ML_INTERNAL_ERROR');
  });

  // 15. Existing rule-based fallback behavior
  it('15. Rule-based fallback produces valid pricing structure', async () => {
    process.env.ML_ENABLED = 'false';
    const result = await getPrice({ chargerId: testCharger._id });

    expect(typeof result.recommendedPrice).toBe('number');
    expect(result.recommendedPrice).toBeGreaterThan(0);
    expect(result.basePrice).toBe(40);
  });

  // 16. Booking price propagation
  it('16. Booking creation correctly calculates total price based on duration and hourly dynamic price', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        timestamp: '2024-11-07 14:00:00',
        model_version: 'xgboost_demand_v1',
        predicted_demand: 0.50,
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

    expect(booking.totalPrice).toBe(80); // 2 hours * 40/hr
    expect(booking.pricingSnapshot.pricePerHour).toBe(40);
  });

  // 17. pricingSnapshot immutability
  it('17. pricingSnapshot remains immutable after booking creation even if demand later changes', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        timestamp: '2024-11-07 10:00:00',
        predicted_demand: 0.40,
      }),
    });

    const startTime = new Date(Date.now() + 7200 * 1000);
    const endTime = new Date(startTime.getTime() + 3600 * 1000);

    const booking = await createBookingWithConcurrencyGuard({
      driverId: testDriver._id,
      chargerId: testCharger._id,
      startTime,
      endTime,
    });

    const originalSavedSnapshotPrice = booking.pricingSnapshot.pricePerHour;
    const originalTotalPrice = booking.totalPrice;

    // Simulate huge demand surge 5 minutes later
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE10-001',
        timestamp: '2024-11-07 10:05:00',
        predicted_demand: 0.95,
      }),
    });

    // Re-query pricing engine (simulating new user browsing)
    await getPrice({ chargerId: testCharger._id, startTime });

    // Verify existing booking object in DB is unchanged
    const reloadedBooking = await Booking.findById(booking._id);
    expect(reloadedBooking.pricingSnapshot.pricePerHour).toBe(originalSavedSnapshotPrice);
    expect(reloadedBooking.totalPrice).toBe(originalTotalPrice);
  });

  // 18. Host-defined price compatibility
  it('18. Respects host-defined base price from Charger model', async () => {
    process.env.ML_ENABLED = 'false';
    const result = await getPrice({ chargerId: testCharger._id });
    expect(result.basePrice).toBe(testCharger.pricePerHour);
  });

  // 19. Existing pricing API contract compatibility
  it('19. GET /api/pricing/:chargerId/pricing maintains full API contract', async () => {
    process.env.ML_ENABLED = 'false';
    const res = await request(app).get(`/api/pricing/${testCharger._id}/pricing`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.basePrice).toBe(40);
    expect(typeof res.body.data.recommendedPrice).toBe('number');
    expect(res.body.data.pricingAlgorithm).toBeDefined();
  });

  // 20. Existing slot concurrency protection
  it('20. Concurrency guard prevents duplicate booking of the same slot', async () => {
    const slot = await Slot.create({
      charger: testCharger._id,
      host: testHost._id,
      startTime: new Date(Date.now() + 10000 * 1000),
      endTime: new Date(Date.now() + 13600 * 1000),
      price: 50,
      status: 'available',
    });

    const b1 = await createBookingWithConcurrencyGuard({
      driverId: testDriver._id,
      chargerId: testCharger._id,
      slotId: slot._id,
    });

    expect(b1).toBeDefined();

    // Second attempt on same slot
    await expect(
      createBookingWithConcurrencyGuard({
        driverId: testDriver._id,
        chargerId: testCharger._id,
        slotId: slot._id,
      })
    ).rejects.toThrow('already reserved');

    await Slot.findByIdAndDelete(slot._id);
  });
});
