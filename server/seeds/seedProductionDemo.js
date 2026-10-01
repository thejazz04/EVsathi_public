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
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { toGeoJSONPoint } from '../utils/geo.js';
import logger from '../utils/logger.js';
import { maskMongoUri } from '../config/db.js';

/**
 * Production-Like Demo Data Seeder
 * Creates realistic data from September 23-28, 2026:
 * - 15 users (8 drivers, 7 hosts)
 * - 15 chargers in Mysore area (ML model trained on Mysore data)
 * - Realistic bookings (past, ongoing, upcoming) with NO overlaps
 * - Chat conversations
 * - Reviews and payments
 * - ML demand data compatible with trained model
 */

const seedProductionDemo = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/evsathi';
    if (mongoose.connection.readyState !== 1) {
      logger.info(`Connecting to MongoDB for production demo seeding: ${maskMongoUri(mongoUri)}`);
      await mongoose.connect(mongoUri, { autoIndex: true });
    }

    logger.info('🚀 Starting production-like demo data seeding...');

    // ===== CLEAR EXISTING DATA =====
    logger.info('🗑️  Clearing existing data...');
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
    await Chat.deleteMany({});
    await Message.deleteMany({});

    // ===== CREATE 15 USERS =====
    logger.info('👥 Creating 15 users...');

    // 8 Drivers
    const drivers = await User.create([
      {
        name: 'Arjun Sharma',
        email: 'arjun.sharma@gmail.com',
        passwordHash: 'password123',
        role: 'driver',
        phone: '+91 98765 43210',
        walletBalance: 2500,
        vehicle: {
          make: 'Tata',
          model: 'Nexon EV Max',
          year: 2024,
          batteryCapacityKwh: 40.5,
          licensePlate: 'DL 01 EV 1234',
          preferredConnector: 'CCS2',
        },
      },
      {
        name: 'Priya Desai',
        email: 'priya.desai@outlook.com',
        passwordHash: 'password123',
        role: 'driver',
        phone: '+91 98234 56789',
        walletBalance: 1800,
        vehicle: {
          make: 'MG',
          model: 'ZS EV',
          year: 2023,
          batteryCapacityKwh: 50.3,
          licensePlate: 'MH 02 EV 5678',
          preferredConnector: 'Type 2',
        },
      },
      {
        name: 'Rahul Verma',
        email: 'rahul.v@yahoo.in',
        passwordHash: 'password123',
        role: 'driver',
        phone: '+91 97123 45678',
        walletBalance: 3200,
        vehicle: {
          make: 'Hyundai',
          model: 'Kona Electric',
          year: 2024,
          batteryCapacityKwh: 39.2,
          licensePlate: 'KA 03 EV 9012',
          preferredConnector: 'CCS2',
        },
      },
      {
        name: 'Sneha Kapoor',
        email: 'sneha.k@gmail.com',
        passwordHash: 'password123',
        role: 'driver',
        phone: '+91 96543 21098',
        walletBalance: 1500,
        vehicle: {
          make: 'Tata',
          model: 'Tigor EV',
          year: 2023,
          batteryCapacityKwh: 26,
          licensePlate: 'TN 01 EV 3456',
          preferredConnector: 'Type 2',
        },
      },
      {
        name: 'Amit Patel',
        email: 'amit.patel@rediffmail.com',
        passwordHash: 'password123',
        role: 'driver',
        phone: '+91 95432 10987',
        walletBalance: 4100,
        vehicle: {
          make: 'BYD',
          model: 'e6',
          year: 2024,
          batteryCapacityKwh: 71.7,
          licensePlate: 'GJ 01 EV 7890',
          preferredConnector: 'CCS2',
        },
      },
      {
        name: 'Kavita Reddy',
        email: 'kavita.reddy@icloud.com',
        passwordHash: 'password123',
        role: 'driver',
        phone: '+91 94321 09876',
        walletBalance: 2900,
        vehicle: {
          make: 'Mahindra',
          model: 'eVerito',
          year: 2023,
          batteryCapacityKwh: 21.2,
          licensePlate: 'AP 09 EV 1122',
          preferredConnector: 'Type 2',
        },
      },
      {
        name: 'Vikram Singh',
        email: 'vikram.singh@proton.me',
        passwordHash: 'password123',
        role: 'driver',
        phone: '+91 93210 98765',
        walletBalance: 3500,
        vehicle: {
          make: 'Tata',
          model: 'Nexon EV',
          year: 2023,
          batteryCapacityKwh: 30.2,
          licensePlate: 'RJ 14 EV 3344',
          preferredConnector: 'CCS2',
        },
      },
      {
        name: 'Deepika Nair',
        email: 'deepika.nair@gmail.com',
        passwordHash: 'password123',
        role: 'driver',
        phone: '+91 92109 87654',
        walletBalance: 1200,
        vehicle: {
          make: 'Hyundai',
          model: 'Ioniq 5',
          year: 2024,
          batteryCapacityKwh: 72.6,
          licensePlate: 'KL 01 EV 5566',
          preferredConnector: 'CCS2',
        },
      },
    ]);

    // 7 Hosts/Owners
    const hosts = await User.create([
      {
        name: 'Rajesh Kumar',
        email: 'rajesh.kumar@gmail.com',
        passwordHash: 'password123',
        role: 'owner',
        phone: '+91 91098 76543',
        walletBalance: 8500,
      },
      {
        name: 'Sunita Agarwal',
        email: 'sunita.agarwal@yahoo.com',
        passwordHash: 'password123',
        role: 'owner',
        phone: '+91 90987 65432',
        walletBalance: 12300,
      },
      {
        name: 'Manoj Gupta',
        email: 'manoj.gupta@outlook.in',
        passwordHash: 'password123',
        role: 'owner',
        phone: '+91 89876 54321',
        walletBalance: 6700,
      },
      {
        name: 'Anita Menon',
        email: 'anita.menon@gmail.com',
        passwordHash: 'password123',
        role: 'owner',
        phone: '+91 88765 43210',
        walletBalance: 9800,
      },
      {
        name: 'Suresh Iyer',
        email: 'suresh.iyer@rediffmail.com',
        passwordHash: 'password123',
        role: 'owner',
        phone: '+91 87654 32109',
        walletBalance: 15200,
      },
      {
        name: 'Pooja Joshi',
        email: 'pooja.joshi@icloud.com',
        passwordHash: 'password123',
        role: 'owner',
        phone: '+91 86543 21098',
        walletBalance: 7400,
      },
      {
        name: 'Karthik Rao',
        email: 'karthik.rao@proton.me',
        passwordHash: 'password123',
        role: 'owner',
        phone: '+91 85432 10987',
        walletBalance: 11900,
      },
    ]);

    logger.info(`✅ Created ${drivers.length} drivers and ${hosts.length} hosts`);

    // ===== CREATE CHARGERS IN MYSORE (ML Model Compatible) =====
    logger.info('🔌 Creating chargers in Mysore area (ML model training region)...');

    const chargers = await Charger.create([
      {
        owner: hosts[0]._id,
        title: 'Mysore Palace Visitor Parking',
        description: 'Fast charging station near the iconic Mysore Palace. Level 2 AC charger with ample parking space for tourists.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 30,
        pricePerKwh: 18,
        hostType: 'Business Host',
        amenities: ['Tourist Area', 'WiFi', 'Restroom', 'CCTV Monitored'],
        location: {
          address: 'Sayyaji Rao Road, Near Mysore Palace East Gate',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570001',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6552, 12.3051).coordinates,
        },
        rating: 4.8,
        totalRatings: 23,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[1]._id,
        title: 'Chamundi Hills Viewpoint Charging',
        description: 'Scenic hilltop charging station at Chamundi Hills. Perfect for tourists visiting the temple with Level 2 charging.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 11,
        pricePerHour: 35,
        pricePerKwh: 21,
        hostType: 'Business Host',
        amenities: ['Scenic View', 'Temple Nearby', 'Covered Parking', 'Cafe'],
        location: {
          address: 'Chamundi Hills Road, Near Temple Parking',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570008',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6727, 12.2725).coordinates,
        },
        rating: 4.9,
        totalRatings: 31,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[2]._id,
        title: 'KRS Dam Visitor Center Fast Charger',
        description: 'DC Fast Charger at the famous Krishnaraja Sagar Dam tourist center. 50kW CCS2 charging for quick top-ups.',
        chargerType: 'DC Fast',
        connectorType: 'CCS2',
        powerOutput: 50,
        pricePerHour: 45,
        pricePerKwh: 22,
        hostType: 'Business Host',
        amenities: ['Tourist Spot', 'Restaurant', 'WiFi', 'Garden View'],
        location: {
          address: 'KRS Road, Dam Visitor Complex',
          city: 'Srirangapatna',
          state: 'Karnataka',
          zipCode: '571438',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.5749, 12.4258).coordinates,
        },
        rating: 4.9,
        totalRatings: 47,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[3]._id,
        title: 'Infosys Mysore Campus Gate Charging',
        description: 'Public access Level 2 charger near Infosys campus gate. Ideal for IT professionals and visitors.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 28,
        pricePerKwh: 17,
        hostType: 'Business Host',
        amenities: ['Corporate Area', 'WiFi', 'Covered Parking', '24/7 Security'],
        location: {
          address: 'Infosys Campus Road, Ring Road Junction',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570027',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6394, 12.3118).coordinates,
        },
        rating: 4.7,
        totalRatings: 28,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[4]._id,
        title: 'Mall of Mysore Underground Parking',
        description: 'Premium underground parking Level 2 charging station at Mall of Mysore. Shop while you charge!',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 11,
        pricePerHour: 32,
        pricePerKwh: 19,
        hostType: 'Business Host',
        amenities: ['Shopping Mall', 'Food Court', 'Cinema', 'WiFi', 'Covered Parking'],
        location: {
          address: 'MG Road, Mall of Mysore B1 Parking',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570001',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6394, 12.3060).coordinates,
        },
        rating: 4.8,
        totalRatings: 39,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[5]._id,
        title: 'Mysore Railway Station P2P Host',
        description: 'Residential P2P host near Railway Station. Convenient for travelers with secure driveway parking.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 25,
        pricePerKwh: 15,
        hostType: 'Home P2P Host',
        amenities: ['Railway Station Nearby', 'CCTV', 'Covered Parking'],
        location: {
          address: 'JLB Road, Near Railway Station',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570001',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6512, 12.3077).coordinates,
        },
        rating: 4.6,
        totalRatings: 18,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[6]._id,
        title: 'Brindavan Gardens Light & Sound Show Parking',
        description: 'Charging station at the famous Brindavan Gardens. Enjoy the musical fountain while your EV charges.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 11,
        pricePerHour: 35,
        pricePerKwh: 21,
        hostType: 'Business Host',
        amenities: ['Garden View', 'Tourist Attraction', 'Restaurant', 'WiFi'],
        location: {
          address: 'Brindavan Gardens, KRS Road',
          city: 'Srirangapatna',
          state: 'Karnataka',
          zipCode: '571606',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.5714, 12.4244).coordinates,
        },
        rating: 4.9,
        totalRatings: 34,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[0]._id,
        title: 'Gokulam Residential Community Charger',
        description: 'Residential community P2P charger in peaceful Gokulam area. Yoga capital neighborhood with excellent facilities.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 26,
        pricePerKwh: 16,
        hostType: 'Home P2P Host',
        amenities: ['Residential Area', 'Quiet Neighborhood', 'WiFi', 'Covered Parking'],
        location: {
          address: 'Contour Road, Gokulam 3rd Stage',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570002',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6231, 12.3134).coordinates,
        },
        rating: 4.8,
        totalRatings: 22,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[1]._id,
        title: 'University of Mysore Campus Charger',
        description: 'Academic campus charging point near Crawford Hall. Available for students, faculty, and visitors.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 24,
        pricePerKwh: 14,
        hostType: 'Business Host',
        amenities: ['University Campus', 'WiFi', 'Library Nearby', 'Cafeteria'],
        location: {
          address: 'Crawford Hall Road, University Campus',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570005',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6394, 12.3117).coordinates,
        },
        rating: 4.7,
        totalRatings: 15,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[2]._id,
        title: 'Devaraja Market P2P Nearby Host',
        description: 'Convenient residential host near the bustling Devaraja Market. Perfect for market visitors.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 27,
        pricePerKwh: 16,
        hostType: 'Home P2P Host',
        amenities: ['Market Nearby', 'Local Shopping', 'CCTV', 'Street Parking'],
        location: {
          address: 'Dhanvanthri Road, Near Devaraja Market',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570001',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6561, 12.3073).coordinates,
        },
        rating: 4.6,
        totalRatings: 12,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[3]._id,
        title: 'Mysore Zoo Visitor Parking Station',
        description: 'Fast charging station at Sri Chamarajendra Zoological Gardens. Great for families visiting the zoo.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 11,
        pricePerHour: 32,
        pricePerKwh: 19,
        hostType: 'Business Host',
        amenities: ['Zoo Nearby', 'Family Friendly', 'Food Stalls', 'WiFi'],
        location: {
          address: 'Zoo Main Road, Indiranagar',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570010',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6648, 12.3015).coordinates,
        },
        rating: 4.8,
        totalRatings: 28,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[4]._id,
        title: 'Jayalakshmipuram Residential P2P',
        description: 'Home P2P host in premium Jayalakshmipuram locality. Safe gated community with covered parking.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricing: { basePrice: 28, surgeMultiplier: 1.0 },
        hostType: 'Home P2P Host',
        amenities: ['Gated Community', 'Covered Parking', 'WiFi', 'CCTV'],
        location: {
          address: 'Mandi Mohalla Main Road, Jayalakshmipuram',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570012',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6211, 12.3214).coordinates,
        },
        rating: 4.9,
        totalRatings: 19,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[5]._id,
        title: 'Bangalore-Mysore Highway Service Plaza',
        description: 'Highway DC Fast Charger on NH-275. Perfect stop for long-distance travelers between Bangalore and Mysore.',
        chargerType: 'DC Fast',
        connectorType: 'CCS2',
        powerOutput: 60,
        pricePerHour: 55,
        pricePerKwh: 26,
        hostType: 'Business Host',
        amenities: ['Highway Stop', 'Restaurant', 'Restroom', 'Convenience Store', 'WiFi'],
        location: {
          address: 'NH-275, Srirangapatna Bypass',
          city: 'Srirangapatna',
          state: 'Karnataka',
          zipCode: '571438',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6850, 12.4150).coordinates,
        },
        rating: 4.9,
        totalRatings: 42,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[6]._id,
        title: 'Kukkarahalli Lake Jogging Track Charger',
        description: 'Scenic charging point near Kukkarahalli Lake. Enjoy morning/evening walks while your EV charges.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 11,
        pricePerHour: 30,
        pricePerKwh: 18,
        hostType: 'Business Host',
        amenities: ['Lake View', 'Jogging Track', 'Bird Watching', 'Peaceful'],
        location: {
          address: 'Bogadi 2nd Stage, Kukkarahalli Lake Road',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570026',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6273, 12.3173).coordinates,
        },
        rating: 4.8,
        totalRatings: 25,
        isAvailable: true,
        isActive: true,
      },
      {
        owner: hosts[0]._id,
        title: 'Lingambudhi Lake Near CFTRI Charger',
        description: 'Research institute area charging station. Close to CFTRI and Lingambudhi Lake scenic spot.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricing: { basePrice: 27, surgeMultiplier: 1.0 },
        hostType: 'Business Host',
        amenities: ['Research Area', 'Lake Nearby', 'WiFi', 'Covered Parking'],
        location: {
          address: 'CFTRI Layout, Near Lingambudhi Lake',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570020',
          country: 'India',
          type: 'Point',
          coordinates: toGeoJSONPoint(76.6489, 12.2887).coordinates,
        },
        rating: 4.7,
        totalRatings: 17,
        isAvailable: true,
        isActive: true,
      },
    ]);

    logger.info(`✅ Created ${chargers.length} chargers`);

    // ===== CREATE PRICING RECORDS =====
    logger.info('💰 Creating pricing records...');
    const pricingRecords = [];
    for (const charger of chargers) {
      pricingRecords.push({
        charger: charger._id,
        basePricePerHour: charger.pricePerHour || 30,
        surgeMultiplier: 1.0,
        isDynamic: true,
      });
    }
    await Pricing.create(pricingRecords);

    // ===== CREATE BOOKINGS (Sep 23-28, 2026) - NO OVERLAPS =====
    logger.info('📅 Creating realistic bookings from Sep 23-28 with NO overlaps...');
    
    const bookings = [];
    const payments = [];
    const sessions = [];
    const reviews = [];
    const chats = [];
    const messages = [];

    // Helper to create date in September 2026
    const createDate = (day, hour, minute = 0) => {
      return new Date(2026, 8, day, hour, minute, 0, 0); // Month is 0-indexed, 8 = September
    };

    // Booking scenarios: Past (23-24), Ongoing (25), Upcoming (26-28)
    // Ensuring NO OVERLAPS per charger
    const bookingData = [
      // Sep 23 - Past completed bookings
      { driver: drivers[0], charger: chargers[0], host: hosts[0], start: createDate(23, 8, 0), duration: 2, status: 'COMPLETED', price: 60 },
      { driver: drivers[1], charger: chargers[1], host: hosts[1], start: createDate(23, 10, 30), duration: 3, status: 'COMPLETED', price: 105 },
      { driver: drivers[2], charger: chargers[2], host: hosts[2], start: createDate(23, 14, 0), duration: 1, status: 'COMPLETED', price: 54 },
      { driver: drivers[3], charger: chargers[3], host: hosts[3], start: createDate(23, 16, 0), duration: 2.5, status: 'COMPLETED', price: 70 },
      { driver: drivers[4], charger: chargers[4], host: hosts[4], start: createDate(23, 19, 0), duration: 3, status: 'COMPLETED', price: 96 },
      { driver: drivers[5], charger: chargers[5], host: hosts[5], start: createDate(23, 7, 0), duration: 1.5, status: 'COMPLETED', price: 37.5 },
      { driver: drivers[6], charger: chargers[6], host: hosts[6], start: createDate(23, 9, 30), duration: 2, status: 'COMPLETED', price: 70 },
      { driver: drivers[7], charger: chargers[7], host: hosts[0], start: createDate(23, 11, 0), duration: 2, status: 'COMPLETED', price: 52 },
      
      // Sep 24 - Past completed bookings (different time slots, NO overlaps)
      { driver: drivers[0], charger: chargers[8], host: hosts[1], start: createDate(24, 6, 0), duration: 3, status: 'COMPLETED', price: 78 },
      { driver: drivers[1], charger: chargers[9], host: hosts[2], start: createDate(24, 8, 30), duration: 2, status: 'COMPLETED', price: 48 },
      { driver: drivers[2], charger: chargers[10], host: hosts[3], start: createDate(24, 13, 0), duration: 2.5, status: 'COMPLETED', price: 80 },
      { driver: drivers[3], charger: chargers[11], host: hosts[4], start: createDate(24, 15, 0), duration: 2, status: 'COMPLETED', price: 56 },
      { driver: drivers[4], charger: chargers[12], host: hosts[5], start: createDate(24, 18, 0), duration: 1.5, status: 'COMPLETED', price: 107.25 },
      { driver: drivers[5], charger: chargers[13], host: hosts[6], start: createDate(24, 10, 0), duration: 3, status: 'COMPLETED', price: 90 },
      { driver: drivers[6], charger: chargers[14], host: hosts[0], start: createDate(24, 16, 30), duration: 2, status: 'COMPLETED', price: 54 },
      
      // Sep 25 - Recent completed & ongoing (different slots)
      { driver: drivers[7], charger: chargers[0], host: hosts[0], start: createDate(25, 11, 0), duration: 2, status: 'COMPLETED', price: 60 },
      { driver: drivers[0], charger: chargers[1], host: hosts[1], start: createDate(25, 14, 0), duration: 2.5, status: 'CONFIRMED', price: 87.5 },
      { driver: drivers[1], charger: chargers[2], host: hosts[2], start: createDate(25, 16, 30), duration: 1, status: 'CONFIRMED', price: 54 },
      { driver: drivers[2], charger: chargers[4], host: hosts[4], start: createDate(25, 9, 0), duration: 2, status: 'COMPLETED', price: 64 },
      { driver: drivers[3], charger: chargers[6], host: hosts[6], start: createDate(25, 12, 0), duration: 3, status: 'CONFIRMED', price: 105 },
      
      // Sep 26 - Upcoming bookings
      { driver: drivers[4], charger: chargers[3], host: hosts[3], start: createDate(26, 8, 0), duration: 2.5, status: 'CONFIRMED', price: 70 },
      { driver: drivers[5], charger: chargers[5], host: hosts[5], start: createDate(26, 11, 30), duration: 1.5, status: 'CONFIRMED', price: 37.5 },
      { driver: drivers[6], charger: chargers[7], host: hosts[0], start: createDate(26, 14, 0), duration: 2, status: 'CONFIRMED', price: 52 },
      { driver: drivers[7], charger: chargers[9], host: hosts[2], start: createDate(26, 17, 0), duration: 2.5, status: 'CONFIRMED', price: 67.5 },
      { driver: drivers[0], charger: chargers[11], host: hosts[4], start: createDate(26, 10, 0), duration: 2, status: 'CONFIRMED', price: 56 },
      { driver: drivers[1], charger: chargers[13], host: hosts[6], start: createDate(26, 16, 0), duration: 3, status: 'CONFIRMED', price: 90 },
      
      // Sep 27 - Upcoming bookings
      { driver: drivers[2], charger: chargers[8], host: hosts[1], start: createDate(27, 9, 0), duration: 2, status: 'CONFIRMED', price: 48 },
      { driver: drivers[3], charger: chargers[10], host: hosts[3], start: createDate(27, 12, 30), duration: 2.5, status: 'CONFIRMED', price: 80 },
      { driver: drivers[4], charger: chargers[0], host: hosts[0], start: createDate(27, 15, 0), duration: 3, status: 'CONFIRMED', price: 90 },
      { driver: drivers[5], charger: chargers[2], host: hosts[2], start: createDate(27, 8, 0), duration: 1, status: 'CONFIRMED', price: 54 },
      { driver: drivers[6], charger: chargers[12], host: hosts[5], start: createDate(27, 19, 0), duration: 1.5, status: 'CONFIRMED', price: 107.25 },
      { driver: drivers[7], charger: chargers[14], host: hosts[0], start: createDate(27, 11, 0), duration: 2, status: 'CONFIRMED', price: 54 },
      
      // Sep 28 - Upcoming bookings
      { driver: drivers[0], charger: chargers[4], host: hosts[4], start: createDate(28, 7, 30), duration: 2.5, status: 'CONFIRMED', price: 80 },
      { driver: drivers[1], charger: chargers[6], host: hosts[6], start: createDate(28, 10, 0), duration: 2, status: 'CONFIRMED', price: 70 },
      { driver: drivers[2], charger: chargers[1], host: hosts[1], start: createDate(28, 13, 30), duration: 3, status: 'CONFIRMED', price: 105 },
      { driver: drivers[3], charger: chargers[3], host: hosts[3], start: createDate(28, 16, 0), duration: 2, status: 'CONFIRMED', price: 56 },
      { driver: drivers[4], charger: chargers[9], host: hosts[2], start: createDate(28, 11, 0), duration: 1.5, status: 'CONFIRMED', price: 40.5 },
      { driver: drivers[5], charger: chargers[13], host: hosts[6], start: createDate(28, 18, 0), duration: 2, status: 'CONFIRMED', price: 60 },
    ];

    for (const data of bookingData) {
      const endTime = new Date(data.start.getTime() + data.duration * 3600 * 1000);
      
      const booking = await Booking.create({
        driver: data.driver._id,
        charger: data.charger._id,
        host: data.host._id,
        startTime: data.start,
        endTime: endTime,
        totalPrice: data.price,
        status: data.status,
        paymentStatus: 'PAID',
        paymentReceiptId: `RZP-${Math.random().toString(36).substring(7).toUpperCase()}`,
        pricingSnapshot: {
          pricePerHour: data.charger.pricePerHour || 30,
          surgeMultiplier: 1.0,
          appliedRules: ['BASE_RATE', 'ML_SURGE'],
        },
        expiresAt: new Date(endTime.getTime() + 86400 * 1000),
      });

      bookings.push(booking);

      // Create payment
      payments.push({
        booking: booking._id,
        user: data.driver._id,
        amount: data.price,
        currency: 'INR',
        razorpayOrderId: `order_${Math.random().toString(36).substring(7)}`,
        razorpayPaymentId: `pay_${Math.random().toString(36).substring(7)}`,
        status: 'VERIFIED',
        paymentMode: 'upi',
      });

      // Create charging session for completed bookings
      if (data.status === 'COMPLETED') {
        const energyConsumed = (data.duration * data.charger.powerOutput * (0.85 + Math.random() * 0.1)).toFixed(2);
        sessions.push({
          driver: data.driver._id,
          charger: data.charger._id,
          booking: booking._id,
          startTime: data.start,
          endTime: endTime,
          energyConsumedKwh: parseFloat(energyConsumed),
          pricePerKwh: 15 + Math.random() * 5,
          totalCost: data.price,
          status: 'COMPLETED',
          telemetryMode: 'SIMULATION',
        });

        // Create review for some completed bookings (70% chance)
        if (Math.random() > 0.3) {
          const reviewTexts = [
            'Excellent charging experience! Host was very friendly.',
            'Great location, fast charging. Will book again.',
            'Clean setup, good amenities. Highly recommended!',
            'Convenient location and fair pricing.',
            'Smooth booking process. Charger worked perfectly.',
            'Nice covered parking, felt very safe.',
            'Good communication from host. Easy to find.',
            'Fast charging, no issues. Worth the price.',
          ];
          
          reviews.push({
            booking: booking._id,
            charger: data.charger._id,
            user: data.driver._id,
            rating: 4 + Math.floor(Math.random() * 2), // 4 or 5
            comment: reviewTexts[Math.floor(Math.random() * reviewTexts.length)],
          });
        }

        // Create chat conversation for some bookings (50% chance)
        if (Math.random() > 0.5) {
          const chat = await Chat.create({
            participants: [data.driver._id, data.host._id],
            charger: data.charger._id,
            booking: booking._id,
            lastMessage: {
              text: 'Thank you for hosting!',
              sender: data.driver._id,
              createdAt: new Date(endTime.getTime() + 300000), // 5 mins after session
            },
            unreadCounts: new Map(),
          });

          chats.push(chat);

          // Create message exchange
          const chatMessages = [
            { sender: data.driver._id, text: `Hi! I have a booking at ${data.start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. How do I find the charger?`, time: data.start.getTime() - 1800000 },
            { sender: data.host._id, text: 'Hello! Welcome. The charger is in slot B3, basement level. Ill be there to guide you.', time: data.start.getTime() - 1200000 },
            { sender: data.driver._id, text: 'Great, thanks! Reaching in 10 minutes.', time: data.start.getTime() - 600000 },
            { sender: data.driver._id, text: 'Charging completed. Thank you for hosting!', time: endTime.getTime() + 180000 },
            { sender: data.host._id, text: 'You\'re welcome! Happy to help. Drive safe!', time: endTime.getTime() + 300000 },
          ];

          for (const msg of chatMessages) {
            messages.push({
              chat: chat._id,
              sender: msg.sender,
              messageText: msg.text,
              createdAt: new Date(msg.time),
              readAt: new Date(msg.time + 60000),
            });
          }
        }
      }
    }

    await Payment.create(payments);
    await ChargingSession.create(sessions);
    await Review.create(reviews);
    await Message.create(messages);

    logger.info(`✅ Created ${bookings.length} bookings, ${payments.length} payments, ${sessions.length} sessions`);
    logger.info(`✅ Created ${reviews.length} reviews, ${chats.length} chats with ${messages.length} messages`);

    // ===== CREATE ML DEMAND DATA =====
    logger.info('🤖 Creating ML demand data for predictions...');
    
    const demandData = [];
    for (const charger of chargers) {
      const [lng, lat] = charger.location.coordinates;
      
      // Create demand data for different hours and patterns
      for (let hour = 0; hour < 24; hour++) {
        let demandValue;
        
        // Realistic demand patterns
        if (hour >= 6 && hour < 9) {
          demandValue = 0.7 + Math.random() * 0.2; // Morning rush
        } else if (hour >= 9 && hour < 12) {
          demandValue = 0.5 + Math.random() * 0.2; // Mid-morning
        } else if (hour >= 12 && hour < 14) {
          demandValue = 0.6 + Math.random() * 0.15; // Lunch time
        } else if (hour >= 14 && hour < 17) {
          demandValue = 0.4 + Math.random() * 0.2; // Afternoon
        } else if (hour >= 17 && hour < 21) {
          demandValue = 0.75 + Math.random() * 0.2; // Evening peak
        } else if (hour >= 21 && hour < 23) {
          demandValue = 0.5 + Math.random() * 0.2; // Late evening
        } else {
          demandValue = 0.1 + Math.random() * 0.2; // Night
        }

        demandData.push({
          charger: charger._id,
          latitude: lat,
          longitude: lng,
          hour,
          dayOfWeek: 3, // Wednesday
          month: 8, // August
          isWeekend: false,
          isHoliday: false,
          demandValue: Math.min(0.98, Math.max(0.05, demandValue)),
        });
      }
    }

    await DemandData.create(demandData);
    logger.info(`✅ Created ${demandData.length} ML demand records`);

    // ===== CREATE PRICING HISTORY =====
    logger.info('📊 Creating pricing history records...');
    
    const pricingHistory = [];
    for (const charger of chargers) {
      for (let i = 0; i < 10; i++) {
        const demand = 0.3 + Math.random() * 0.6;
        const utilization = 0.2 + Math.random() * 0.6;
        
        pricingHistory.push({
          charger: charger._id,
          state: {
            predictedDemand: demand,
            actualDemand: demand + (Math.random() - 0.5) * 0.1,
            electricityTariff: 8 + Math.random() * 2,
            gridCondition: Math.random() > 0.5 ? 'Optimal' : 'Moderate',
            utilization,
            currentPrice: charger.pricePerHour || 30,
          },
          action: {
            selectedPrice: (charger.pricePerHour || 30) * (1 + demand * 0.5),
            pricingModel: 'ML_BASED',
          },
          outcome: {
            sessionsCount: Math.floor(1 + Math.random() * 3),
            energyConsumedKwh: 10 + Math.random() * 30,
            totalRevenue: 100 + Math.random() * 200,
            resultingUtilization: utilization + 0.1,
            calculatedReward: 1 + Math.random() * 2,
          },
        });
      }
    }

    await PricingHistory.create(pricingHistory);
    logger.info(`✅ Created ${pricingHistory.length} pricing history records`);

    // ===== CREATE NOTIFICATIONS =====
    logger.info('🔔 Creating notifications...');
    
    const notifications = [];
    for (const booking of bookings.slice(0, 15)) {
      notifications.push({
        recipient: booking.driver,
        title: 'Booking Confirmed',
        message: `Your charging session is confirmed for ${new Date(booking.startTime).toLocaleDateString('en-IN')}`,
        type: 'BOOKING_CONFIRMED',
        isRead: booking.status === 'COMPLETED',
      });
    }

    await Notification.create(notifications);
    logger.info(`✅ Created ${notifications.length} notifications`);

    // ===== SUMMARY =====
    logger.info('\n🎉 Production-like demo data seeding completed!\n');
    logger.info('📊 Summary:');
    logger.info(`   - Users: ${drivers.length + hosts.length} (${drivers.length} drivers, ${hosts.length} hosts)`);
    logger.info(`   - Chargers: ${chargers.length} in Mysore area (ML model compatible)`);
    logger.info(`   - Bookings: ${bookings.length} (Sep 23-28, 2026) - NO OVERLAPS`);
    logger.info(`   - Completed Sessions: ${sessions.length}`);
    logger.info(`   - Reviews: ${reviews.length}`);
    logger.info(`   - Chats: ${chats.length} with ${messages.length} messages`);
    logger.info(`   - ML Demand Data: ${demandData.length} records (Mysore coordinates)`);
    logger.info(`   - Pricing History: ${pricingHistory.length} records`);
    logger.info(`   - Notifications: ${notifications.length}`);
    logger.info('\n📍 All chargers are in Mysore/Srirangapatna area - ML model trained region');
    logger.info('✨ Your EVsathi demo is ready for presentation!\n');

  } catch (err) {
    logger.error('❌ Seeding error:', { error: err.message, stack: err.stack });
    throw err;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      logger.info('Database connection closed');
    }
  }
};

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith('seedProductionDemo.js')) {
  seedProductionDemo()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default seedProductionDemo;
