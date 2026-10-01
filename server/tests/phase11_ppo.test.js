import dotenv from 'dotenv';
dotenv.config();
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';
import Charger from '../models/Charger.js';
import Pricing from '../models/Pricing.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';
import { getPrice } from '../services/pricing/pricing.service.js';
import { computeDynamicPricing } from '../services/ml/dynamic-pricing.service.js';
import { createBookingWithConcurrencyGuard } from '../services/booking/booking.service.js';

describe('Phase 11: PPO Dynamic Pricing Shadow Mode & Failure Fallback Test Suite', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  let testCharger;
  let testDriver;
  let testHost;

  beforeAll(async () => {
    await connectDB();

    testHost = await User.findOne({ email: 'phase11_host_test@evsathi.internal' });
    if (!testHost) {
      testHost = await User.create({
        name: 'Phase 11 Host',
        email: 'phase11_host_test@evsathi.internal',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv1234567890abcdefghijklmnopqrstu',
        role: 'HOST',
        phone: '+919876543230',
      });
    }

    testDriver = await User.findOne({ email: 'phase11_driver_test@evsathi.internal' });
    if (!testDriver) {
      testDriver = await User.create({
        name: 'Phase 11 Driver',
        email: 'phase11_driver_test@evsathi.internal',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv1234567890abcdefghijklmnopqrstu',
        role: 'DRIVER',
        phone: '+919876543231',
      });
    }

    testCharger = await Charger.findOne({ title: 'CHG-PHASE11-001' });
    if (!testCharger) {
      testCharger = await Charger.create({
        title: 'CHG-PHASE11-001',
        owner: testHost._id,
        pricePerHour: 50,
        pricePerKwh: 20,
        chargerType: 'DC_FAST',
        powerOutput: 60,
        isActive: false,
        location: {
          address: 'Connaught Place, New Delhi',
          city: 'New Delhi',
          state: 'Delhi',
          zipCode: '110001',
          coordinates: [77.21, 28.63],
        },
      });
    }

    let testPricing = await Pricing.findOne({ charger: testCharger._id });
    if (!testPricing) {
      await Pricing.create({
        charger: testCharger._id,
        basePricePerHour: 50,
        basePricePerKwh: 20,
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

  // 1. GET /api/ml/status
  it('1. GET /api/ml/status indicates active PPO shadow mode', async () => {
    const res = await request(app).get('/api/ml/status');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pricingModelStatus).toBe('SHADOW_EVALUATION');
    expect(res.body.data.ppoPricingModelStatus).toBe('ACTIVE_SHADOW_MODE');
  });

  // 2. POST /api/ml/dynamic-pricing shadow evaluation endpoint
  it('2. POST /api/ml/dynamic-pricing evaluates PPO in shadow mode with 200 OK', async () => {
    const res = await request(app).post('/api/ml/dynamic-pricing').send({
      chargerId: String(testCharger._id),
      basePrice: 50,
      predictedDemand: 0.70,
      hour: 14,
      isWeekend: false,
      isFastCharger: true,
      deterministicMultiplier: 1.20,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.shadowMode).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.proposedPrice).toBe('number');
    expect(typeof res.body.data.proposedMultiplier).toBe('number');
    expect(res.body.data.mode).toBe('SHADOW_EVALUATION');
  });

  // 3. PPO Continuous Action Validation
  it('3. PPO policy maps continuous action to bounded multiplier in [0.50, 1.50]', async () => {
    const result = await computeDynamicPricing({
      chargerId: testCharger._id,
      basePrice: 50,
      predictedDemand: 0.85,
    });

    expect(result.data.action).toBeGreaterThanOrEqual(-1.0);
    expect(result.data.action).toBeLessThanOrEqual(1.0);
    expect(result.data.proposedMultiplier).toBeGreaterThanOrEqual(0.50);
    expect(result.data.proposedMultiplier).toBeLessThanOrEqual(1.50);
  });

  // 4. Floor Price Clamp Protection
  it('4. PPO proposed price is safety clamped at minimum 0.5x base price', async () => {
    const result = await computeDynamicPricing({
      chargerId: testCharger._id,
      basePrice: 50,
      predictedDemand: 0.01, // Extreme low demand
    });

    const minAllowed = Math.max(1, Math.round(50 * 0.50)); // 25
    expect(result.data.proposedPrice).toBeGreaterThanOrEqual(minAllowed);
  });

  // 5. Ceiling Price Clamp Protection
  it('5. PPO proposed price is safety clamped at maximum 2.0x base price', async () => {
    const result = await computeDynamicPricing({
      chargerId: testCharger._id,
      basePrice: 50,
      predictedDemand: 1.0, // Extreme high demand
    });

    const maxAllowed = Math.round(50 * 2.00); // 100
    expect(result.data.proposedPrice).toBeLessThanOrEqual(maxAllowed);
  });

  // 6. Production Price Immutability Guarantee
  it('6. Production pricing engine (getPrice) remains 100% authoritative and unaffected by PPO', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE11-001',
        timestamp: '2024-11-07 14:00:00',
        predicted_demand: 0.60,
      }),
    });

    const targetTime = new Date(2024, 10, 7, 14, 0, 0);
    const prodPriceResult = await getPrice({
      chargerId: testCharger._id,
      startTime: targetTime,
    });

    // Production algorithm MUST remain XGBOOST_ADVISORY_RULE_BASED
    expect(prodPriceResult.pricingAlgorithm).toBe('XGBOOST_ADVISORY_RULE_BASED');
    expect(prodPriceResult.recommendedPrice).toBeDefined();
  });

  // 7. Booking pricingSnapshot Immutability
  it('7. Booking creation records Phase 10 production price and is never altered by PPO', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        charger_id: 'CHG-PHASE11-001',
        timestamp: '2024-11-07 14:00:00',
        predicted_demand: 0.50,
      }),
    });

    const startTime = new Date(Date.now() + 3600 * 1000);
    const endTime = new Date(startTime.getTime() + 2 * 3600 * 1000);

    const booking = await createBookingWithConcurrencyGuard({
      driverId: testDriver._id,
      chargerId: testCharger._id,
      startTime,
      endTime,
    });

    expect(booking.pricingSnapshot).toBeDefined();
    expect(booking.totalPrice).toBe(100); // 2 hours * 50/hr
    expect(booking.pricingSnapshot.pricePerHour).toBe(50);
  });

  // 8. ML Disabled Fallback for PPO Shadow Evaluation
  it('8. PPO shadow evaluation gracefully falls back when ML_ENABLED=false', async () => {
    process.env.ML_ENABLED = 'false';
    const result = await computeDynamicPricing({
      chargerId: testCharger._id,
      basePrice: 50,
    });

    expect(result.success).toBe(true);
    expect(result.shadowMode).toBe(true);
    expect(result.shadowStatus).toBe('FALLBACK');
    expect(result.fallbackReason).toBe('ML_SERVICE_DISABLED');
    expect(result.data.proposedPrice).toBeGreaterThan(0);
  });

  // 9. FastAPI PPO Service Unavailable Fallback
  it('9. Handles FastAPI PPO service unreachable (ECONNREFUSED) with clean fallback', async () => {
    process.env.ML_ENABLED = 'true';
    global.fetch = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8000'));

    const result = await computeDynamicPricing({
      chargerId: testCharger._id,
      basePrice: 50,
    });

    expect(result.shadowStatus).toBe('FALLBACK');
    expect(result.fallbackReason).toBe('ML_PPO_UNAVAILABLE');
  });

  // 10. FastAPI PPO Timeout Fallback
  it('10. Handles FastAPI PPO timeout (>5000ms AbortError) with clean fallback', async () => {
    process.env.ML_ENABLED = 'true';
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortErr);

    const result = await computeDynamicPricing({
      chargerId: testCharger._id,
      basePrice: 50,
    });

    expect(result.shadowStatus).toBe('FALLBACK');
  });

  // 11. Malformed PPO Input Safety
  it('11. Handles NaN or null predictedDemand inputs without throwing unhandled error', async () => {
    const result = await computeDynamicPricing({
      chargerId: testCharger._id,
      basePrice: 50,
      predictedDemand: NaN,
    });

    expect(result.success).toBe(true);
    expect(typeof result.data.proposedPrice).toBe('number');
  });

  // 12. Host Base Rate Compatibility
  it('12. Dynamic pricing shadow evaluation respects host base rate', async () => {
    const result = await computeDynamicPricing({
      chargerId: testCharger._id,
      basePrice: testCharger.pricePerHour,
    });

    expect(result.data.minAllowedPrice).toBe(25); // 0.5 * 50
    expect(result.data.maxAllowedPrice).toBe(100); // 2.0 * 50
  });

  // 13. High Concurrency Requests
  it('13. Supports concurrent shadow evaluation queries cleanly', async () => {
    const queries = Array.from({ length: 5 }, (_, i) =>
      computeDynamicPricing({
        chargerId: testCharger._id,
        basePrice: 50,
        predictedDemand: 0.2 + i * 0.15,
      })
    );

    const results = await Promise.all(queries);
    expect(results).toHaveLength(5);
    results.forEach((res) => {
      expect(res.success).toBe(true);
      expect(res.shadowMode).toBe(true);
    });
  });
});
