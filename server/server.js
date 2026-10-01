import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

// Validate JWT secrets after .env is loaded
import { validateJWTSecrets } from './utils/jwt.js';
validateJWTSecrets();

import app from './app.js';
import { connectDB } from './config/db.js';
import { initSocket } from './config/socket.js';
import { startBookingExpiryJob } from './services/booking/booking.expiry.service.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect MongoDB
  await connectDB();

  // Create HTTP Server
  const server = http.createServer(app);

  // Initialize Socket.IO
  initSocket(server);

  // Start Non-Destructive Booking Expiration Worker Job
  startBookingExpiryJob();

  server.listen(PORT, () => {
    logger.info(`⚡ EVsathi Backend Server running on http://localhost:${PORT}`);
    logger.info(`Mode: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Payment Mode: ${process.env.PAYMENT_MODE || 'mock'}`);
    logger.info(`Charging Telemetry Mode: ${process.env.CHARGING_MODE || 'simulation'}`);
    logger.info(`Navigation Provider: ${process.env.NAVIGATION_PROVIDER || 'osrm'}`);
  });
};

startServer().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
