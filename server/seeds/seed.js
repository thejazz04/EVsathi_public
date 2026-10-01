import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User.js';
import Charger from '../models/Charger.js';
import Booking from '../models/Booking.js';
import ChargingSession from '../models/ChargingSession.js';
import Slot from '../models/Slot.js';
import Pricing from '../models/Pricing.js';
import PricingHistory from '../models/PricingHistory.js';
import DemandData from '../models/DemandData.js';
import Review from '../models/Review.js';
import Notification from '../models/Notification.js';
import Payment from '../models/Payment.js';
import { toGeoJSONPoint } from '../utils/geo.js';
import logger from '../utils/logger.js';
import { maskMongoUri } from '../config/db.js';

export const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/evsathi';
    if (mongoose.connection.readyState !== 1) {
      logger.info(`Connecting to MongoDB Atlas for seeding: ${maskMongoUri(mongoUri)}`);
      await mongoose.connect(mongoUri, { autoIndex: true });
    }

    logger.info('Seeding MongoDB Atlas with deterministic demo data...');

    // Clear existing development collections safely
    await User.deleteMany({});
    await Charger.deleteMany({});
    await Booking.deleteMany({});
    await ChargingSession.deleteMany({});
    await Slot.deleteMany({});
    await Pricing.deleteMany({});
    await PricingHistory.deleteMany({});
    await DemandData.deleteMany({});
    await Review.deleteMany({});
    await Notification.deleteMany({});
    await Payment.deleteMany({});

    // 1. Create Test Driver Accounts
    const driverUser = await User.create({
      name: 'Demo EV Driver',
      email: 'driver@evsathi.ai',
      passwordHash: 'password123',
      role: 'driver',
      phone: '+91 98765 43210',
      walletBalance: 1500,
      vehicle: {
        make: 'Tata',
        model: 'Nexon EV Max',
        year: 2024,
        batteryCapacityKwh: 40.5,
        licensePlate: 'DL 01 EV 9900',
        preferredConnector: 'CCS2',
      },
    });

    await User.create({
      name: 'Demo EV Driver',
      email: 'driver@evsathi.in',
      passwordHash: 'driver123',
      role: 'driver',
      phone: '+91 98765 43210',
      walletBalance: 1500,
    });

    // 2. Create Test Host Accounts
    const hostUser = await User.create({
      name: 'Demo Host',
      email: 'host@evsathi.ai',
      passwordHash: 'password123',
      role: 'owner',
      phone: '+91 98123 45678',
      walletBalance: 4500,
    });

    await User.create({
      name: 'Demo Host',
      email: 'host@evsathi.in',
      passwordHash: 'host123',
      role: 'owner',
      phone: '+91 98123 45678',
      walletBalance: 4500,
    });

    logger.info('Created demo Driver & Host user accounts in MongoDB Atlas...');

    // 3. Create Indian P2P Residential & Fast Chargers
    const charger1 = await Charger.create({
      owner: hostUser._id,
      title: 'Residential P2P Host - Sector 62 Driveway',
      description: 'Private 7.4 kW Level 2 AC Charger located in a safe residential gated society. Covered driveway parking, CCTV monitored, high-speed WiFi available.',
      chargerType: 'Level 2',
      connectorType: 'Type 2',
      powerOutput: 7.4,
      pricePerHour: 25,
      pricePerKwh: 15,
      hostType: 'Home P2P Host',
      amenities: ['Covered Parking', 'WiFi', 'CCTV Monitored', 'Restroom Access'],
      location: {
        address: 'House 42, Block C, Sector 62',
        city: 'Noida',
        state: 'Uttar Pradesh',
        zipCode: '201301',
        country: 'India',
        type: 'Point',
        coordinates: toGeoJSONPoint(28.627, 77.372).coordinates,
      },
      rating: 4.8,
      totalRatings: 12,
      isAvailable: true,
      isActive: true,
    });

    const charger2 = await Charger.create({
      owner: hostUser._id,
      title: 'Highway Fast Charging Hub - Hub B',
      description: 'Ultra-fast 50 kW CCS2 DC Fast Charger near Expressway exit. Perfect for long distance highway trips.',
      chargerType: 'DC Fast',
      connectorType: 'CCS2',
      powerOutput: 50,
      pricePerHour: 120,
      pricePerKwh: 22,
      hostType: 'Business Host',
      amenities: ['Coffee Shop', 'WiFi', 'CCTV Monitored', 'Wash Bay'],
      location: {
        address: 'NH-48 Mile 34, Near Expressway Exit',
        city: 'Gurugram',
        state: 'Haryana',
        zipCode: '122001',
        country: 'India',
        type: 'Point',
        coordinates: toGeoJSONPoint(28.4595, 77.0266).coordinates,
      },
      rating: 4.9,
      totalRatings: 28,
      isAvailable: true,
      isActive: true,
    });

    logger.info('Created P2P Indian Chargers in Atlas...');

    // 4. Create Slots
    const now = new Date();
    await Slot.create([
      {
        charger: charger1._id,
        startTime: new Date(now.getTime() + 1 * 3600 * 1000),
        endTime: new Date(now.getTime() + 3 * 3600 * 1000),
        price: 25,
        status: 'available',
      },
      {
        charger: charger1._id,
        startTime: new Date(now.getTime() + 4 * 3600 * 1000),
        endTime: new Date(now.getTime() + 6 * 3600 * 1000),
        price: 25,
        status: 'available',
      },
      {
        charger: charger2._id,
        startTime: new Date(now.getTime() + 2 * 3600 * 1000),
        endTime: new Date(now.getTime() + 4 * 3600 * 1000),
        price: 120,
        status: 'available',
      },
    ]);

    // 5. Create Sample Booking
    const booking = await Booking.create({
      driver: driverUser._id,
      charger: charger1._id,
      host: hostUser._id,
      startTime: new Date(Date.now() - 3600 * 1000),
      endTime: new Date(Date.now() + 3600 * 1000),
      totalPrice: 50,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      paymentReceiptId: 'RZP-89210-EV',
      pricingSnapshot: {
        pricePerHour: 25,
        surgeMultiplier: 1.0,
        appliedRules: ['BASE_RATE'],
      },
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });

    // 6. Create Payment Record
    await Payment.create({
      booking: booking._id,
      user: driverUser._id,
      amount: 50,
      currency: 'INR',
      razorpayOrderId: 'order_demo_12345',
      razorpayPaymentId: 'pay_demo_67890',
      status: 'VERIFIED',
      paymentMode: 'mock',
    });

    // 7. Create Sample Charging Session
    await ChargingSession.create({
      driver: driverUser._id,
      charger: charger1._id,
      booking: booking._id,
      startTime: new Date(Date.now() - 1800 * 1000),
      energyConsumedKwh: 14.2,
      pricePerKwh: 15,
      totalCost: 213,
      status: 'CHARGING',
      telemetryMode: 'SIMULATION',
    });

    // 8. Create Pricing Rules & Analytics Records
    await Pricing.create({
      charger: charger1._id,
      basePricePerHour: 25,
      surgeMultiplier: 1.0,
      isDynamic: true,
    });

    await PricingHistory.create({
      charger: charger1._id,
      state: { predictedDemand: 0.65, actualDemand: 0.60, electricityTariff: 8.5, gridCondition: 'Optimal', utilization: 0.5, currentPrice: 25 },
      action: { selectedPrice: 25, pricingModel: 'RULE_BASED' },
      outcome: { sessionsCount: 1, energyConsumedKwh: 14.2, totalRevenue: 213, resultingUtilization: 0.6, calculatedReward: 1.2 },
    });

    await DemandData.create({
      charger: charger1._id,
      latitude: 28.627,
      longitude: 77.372,
      hour: 14,
      dayOfWeek: 4,
      month: 9,
      isWeekend: false,
      isHoliday: false,
      demandValue: 0.68,
    });

    // 9. Create Review
    await Review.create({
      booking: booking._id,
      charger: charger1._id,
      user: driverUser._id,
      rating: 5,
      comment: 'Excellent residential host! Clean driveway, fast 7.4 kW charging, highly recommended.',
    });

    // 10. Create Notification
    await Notification.create({
      recipient: driverUser._id,
      title: 'Booking Confirmed',
      message: 'Your charging session at Sector 62 Driveway is confirmed.',
      type: 'BOOKING_CONFIRMED',
      isRead: false,
    });

    logger.info('MongoDB Atlas seed completed successfully!');
  } catch (err) {
    logger.error('Atlas seed error', { error: err.message });
    throw err;
  }
};

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
