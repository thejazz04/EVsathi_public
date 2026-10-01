import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import path from 'path';

import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import chargerRoutes from './routes/chargerRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import slotRoutes from './routes/slotRoutes.js';
import chargingRoutes from './routes/chargingRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import navigationRoutes from './routes/navigationRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import mlRoutes from './routes/mlRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

const app = express();

// Security Headers & CORS
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

// Payment Webhook raw body route (MUST come before express.json body parser)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));

// Standard JSON & URL Encoded Body Parsers (10MB limit for image uploads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie Parser (for HttpOnly refresh tokens)
app.use(cookieParser());

// MongoDB Query Injection Sanitization
app.use(mongoSanitize());

// Global Rate Limiter
app.use('/api/', apiRateLimiter);

// Serve Static Uploads
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Register API Routes (Supporting both /api and /api/v1 namespaces)
const registerRoutes = (prefix) => {
  app.use(`${prefix}/health`, healthRoutes);
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/chargers`, chargerRoutes);
  app.use(`${prefix}/bookings`, bookingRoutes);
  app.use(`${prefix}/slots`, slotRoutes);
  app.use(`${prefix}/charging`, chargingRoutes);
  app.use(`${prefix}/payments`, paymentRoutes);
  app.use(`${prefix}/payment`, paymentRoutes); // Support frontend fallback route
  app.use(`${prefix}/navigation`, navigationRoutes);
  app.use(`${prefix}/analytics`, analyticsRoutes);
  app.use(`${prefix}/chats`, chatRoutes);
  app.use(`${prefix}/reviews`, reviewRoutes);
  app.use(`${prefix}/pricing`, pricingRoutes);
  app.use(`${prefix}/ml`, mlRoutes);
  app.use(`${prefix}/notifications`, notificationRoutes);
  app.use(`${prefix}/upload`, uploadRoutes);
  app.use(`${prefix}/wallet`, walletRoutes);
};

registerRoutes('/api');
registerRoutes('/api/v1');

// Serve Static Frontend (Production) - MUST come AFTER API routes
const distDir = path.join(process.cwd(), 'client', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDir));

  // Handle React Router client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
