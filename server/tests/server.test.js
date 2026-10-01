import dotenv from 'dotenv';
dotenv.config();
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { connectDB } from '../config/db.js';

describe('EVsathi Backend API Integration Tests', () => {
  beforeAll(async () => {
    await connectDB();
  }, 15000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it('GET /api/health should return 200 OK with system status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.server).toEqual('online');
    expect(res.body.data.paymentMode).toBeDefined();
    expect(res.body.data.chargingMode).toEqual('simulation');
    expect(res.body.data.navigationProvider).toEqual('osrm');
  });

  it('GET /api/chargers should return list of chargers', async () => {
    const res = await request(app).get('/api/chargers');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.chargers)).toBe(true);
  });

  it('GET /api/chargers/:id/slots/grid should return slot grid', async () => {
    const listRes = await request(app).get('/api/chargers');
    const firstCharger = listRes.body?.data?.chargers?.[0];
    const chargerId = firstCharger ? firstCharger._id : '600adae0f62df6232a50ac43';

    const res = await request(app).get(`/api/chargers/${chargerId}/slots/grid`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.slots)).toBe(true);
  });
});
