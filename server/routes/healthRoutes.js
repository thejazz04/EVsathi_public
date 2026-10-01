import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  res.status(200).json({
    success: true,
    data: {
      server: 'online',
      environment: process.env.NODE_ENV || 'development',
      database: dbStatusMap[dbState] || 'unknown',
      socket: 'initialized',
      paymentMode: process.env.PAYMENT_MODE || 'mock',
      chargingMode: process.env.CHARGING_MODE || 'simulation',
      navigationProvider: process.env.NAVIGATION_PROVIDER || 'osrm',
      mlStatus: process.env.ML_ENABLED === 'true' ? 'enabled' : 'fallback_active',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
