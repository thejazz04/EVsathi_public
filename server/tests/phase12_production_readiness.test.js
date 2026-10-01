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
import { computeDynamicPricing } from '../services/ml/dynamic-pricing.service.js';
import { createBookingWithConcurrencyGuard } from '../services/booking/booking.service.js';

describe('Phase 12: End-to-End Production Readiness & Critical System Invariant Tests', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  let testHost;
  let testDriver;
  let testCharger;

  beforeAll(async () => {
    await connectDB();

    testHost = await User.findOne({ email: 'phase12_host_test@evsathi.internal' });
    if (!testHost) {
      testHost = await User.create({
        name: 'Phase 12 Host',
        email: 'phase12_host_test@evsathi.internal',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv1234567890abcdefghijklmnopqrstu',
        role: 'HOST',
        phone: '+919876543240',
        walletBalance: 1000,
      });
    }

    testDriver = await User.findOne({ email: 'phase12_driver_test@evsathi.internal' });
    if (!testDriver) {
      testDriver = await User.create({
        name: 'Phase 12 Driver',
        email: 'phase12_driver_test@evsathi.internal',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv1234567890abcdefghijklmnopqrstu',
        role: 'DRIVER',
        phone: '+919876543241',
        walletBalance: 2000,
      });
    }

    testCharger = await Charger.findOne({ title: 'CHG-PHASE12-001' });
    if (!testCharger) {
      testCharger = await Charger.create({
        title: 'CHG-PHASE12-001',
        owner: testHost._id,
        pricePerHour: 45,
        pricePerKwh: 18,
        chargerType: 'DC_FAST',
        powerOutput: 50,
        isActive: false,
        location: {
          address: 'MG Road, Bengaluru',
          city: 'Bengaluru',
          state: 'Karnataka',
          zipCode: '560001',
          coordinates: [77.60, 12.97],
        },
      });
    }

    let testPricing = await Pricing.findOne({ charger: testCharger._id });
    if (!testPricing) {
      await Pricing.create({
        charger: testCharger._id,
        basePricePerHour: 45,
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

  // 1. Authentication Security Invariants
  describe('1. Authentication & Route Protection Invariants', () => {
    it('rejects unauthenticated access to protected routes with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect([401, 403]).toContain(res.statusCode);
      expect(res.body.success).toBe(false);
    });

    it('rejects malformed or invalid JWT tokens with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_garbage_token');
      expect([401, 403]).toContain(res.statusCode);
      expect(res.body.success).toBe(false);
    });
  });

  // 2. Production Pricing & XGBoost Invariants
  describe('2. Phase 10 Production Pricing Invariants', () => {
    it('Phase 10 deterministic pricing engine remains authoritative production pricing system', async () => {
      process.env.ML_ENABLED = 'true';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          charger_id: 'CHG-PHASE12-001',
          timestamp: '2024-11-07 14:00:00',
          predicted_demand: 0.65,
        }),
      });

      const result = await getPrice({
        chargerId: testCharger._id,
        startTime: new Date(2024, 10, 7, 14, 0, 0),
      });

      expect(result.pricingAlgorithm).toBe('XGBOOST_ADVISORY_RULE_BASED');
      expect(result.recommendedPrice).toBeGreaterThan(0);
      expect(result.basePrice).toBe(45);
      expect(result.demandFactor).toBe(1.30);
    });

    it('Enforces strict price safety bounds [0.5x, 2.0x base]', async () => {
      process.env.ML_ENABLED = 'false';
      const result = await getPrice({ chargerId: testCharger._id });
      const minAllowed = Math.max(1, Math.round(45 * 0.5));
      const maxAllowed = Math.round(45 * 2.0);

      expect(result.recommendedPrice).toBeGreaterThanOrEqual(minAllowed);
      expect(result.recommendedPrice).toBeLessThanOrEqual(maxAllowed);
    });

    it('Gracefully falls back to commute schedule rules when ML is disabled', async () => {
      process.env.ML_ENABLED = 'false';
      const result = await getPrice({ chargerId: testCharger._id });

      expect(result.pricingAlgorithm).toBe('RULE_BASED_PRICING');
      expect(result.mlStatus).toBe('FALLBACK');
      expect(result.fallbackReason).toBe('ML_SERVICE_DISABLED');
    });
  });

  // 3. Phase 11 PPO Shadow Mode Invariants
  describe('3. Phase 11 PPO Shadow Mode Invariants', () => {
    it('PPO operates strictly in SHADOW MODE ONLY via POST /api/ml/dynamic-pricing', async () => {
      const res = await request(app).post('/api/ml/dynamic-pricing').send({
        chargerId: String(testCharger._id),
        basePrice: 45,
        predictedDemand: 0.70,
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.shadowMode).toBe(true);
      expect(res.body.data.mode).toBe('SHADOW_EVALUATION');
      expect(res.body.data.disclaimer).toContain('Shadow Mode');
    });

    it('PPO shadow evaluations NEVER alter production booking pricingSnapshot', async () => {
      // Execute shadow query
      await computeDynamicPricing({
        chargerId: testCharger._id,
        basePrice: 45,
        predictedDemand: 0.95, // Extreme shadow surge proposal
      });

      // Create booking
      const startTime = new Date(Date.now() + 3600 * 1000);
      const endTime = new Date(startTime.getTime() + 3600 * 1000);

      const booking = await createBookingWithConcurrencyGuard({
        driverId: testDriver._id,
        chargerId: testCharger._id,
        startTime,
        endTime,
      });

      // Verification: Booking pricing snapshot contains Phase 10 rate, NOT PPO shadow rate
      expect(booking.pricingSnapshot).toBeDefined();
      expect(booking.totalPrice).toBe(45);
      expect(booking.pricingSnapshot.pricePerHour).toBe(45);
    });
  });

  // 4. Booking Concurrency & Snapshot Immutability Invariants
  describe('4. Booking Concurrency & Data Integrity Invariants', () => {
    it('prevents race conditions and duplicate slot reservations with 409 conflict', async () => {
      const slot = await Slot.create({
        charger: testCharger._id,
        host: testHost._id,
        startTime: new Date(Date.now() + 20000 * 1000),
        endTime: new Date(Date.now() + 23600 * 1000),
        price: 60,
        status: 'available',
      });

      const b1 = await createBookingWithConcurrencyGuard({
        driverId: testDriver._id,
        chargerId: testCharger._id,
        slotId: slot._id,
      });
      expect(b1).toBeDefined();

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
});
