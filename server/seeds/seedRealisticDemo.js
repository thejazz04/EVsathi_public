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
 * Realistic Production Demo Data Seeder
 * ======================================
 * Date Range: September 23-28, 2026
 * Location: MYSORE REGION ONLY (ML model trained on Mysore coordinates)
 * 
 * Creates:
 * - 15 users (8 drivers, 7 hosts)
 * - 15 chargers in Mysore/Srirangapatna (Lat: 12.2-12.5, Lon: 76.5-76.7)
 * - 40+ bookings with NO overlaps per charger
 * - Chat conversations with realistic messages
 * - Reviews, payments, charging sessions
 * - ML-compatible demand data (matches feature schema)
 */

const seedRealisticDemo = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/evsathi';
    if (mongoose.connection.readyState !== 1) {
      logger.info(`Connecting to MongoDB: ${maskMongoUri(mongoUri)}`);
      await mongoose.connect(mongoUri, { autoIndex: true });
    }

    logger.info('\n🚀 Starting REALISTIC Production Demo Data Seeding...\n');
    logger.info('📍 Region: Mysore, Karnataka (ML Model Training Region)');
    logger.info('📅 Date Range: September 23-28, 2026');
    logger.info('✅ ML Feature Schema Compatible\n');

    // ===== CLEAR EXISTING DATA =====
    logger.info('🗑️  Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Charger.deleteMany({}),
      Booking.deleteMany({}),
      ChargingSession.deleteMany({}),
      Slot.deleteMany({}),
      Pricing.deleteMany({}),
      PricingHistory.deleteMany({}),
      DemandData.deleteMany({}),
      Review.deleteMany({}),
      Notification.deleteMany({}),
      Payment.deleteMany({}),
      Chat.deleteMany({}),
      Message.deleteMany({}),
    ]);
    logger.info('✅ Collections cleared\n');

    // ===== CREATE 15 USERS =====
    logger.info('👥 Creating 15 users (8 drivers, 7 hosts)...');

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
          licensePlate: 'KA 09 EV 1234',
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
          licensePlate: 'KA 09 EV 5678',
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
          licensePlate: 'KA 09 EV 9012',
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
          licensePlate: 'KA 09 EV 3456',
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
          licensePlate: 'KA 09 EV 7890',
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
          licensePlate: 'KA 09 EV 1122',
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
          licensePlate: 'KA 09 EV 3344',
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
          licensePlate: 'KA 09 EV 5566',
          preferredConnector: 'CCS2',
        },
      },
    ]);

    const hosts = await User.create([
      {
        name: 'Rajesh Kumar',
        email: 'rajesh.kumar@gmail.com',
        passwordHash: 'password123',
        role: 'HOST',
        phone: '+91 91098 76543',
        walletBalance: 8500,
      },
      {
        name: 'Sunita Agarwal',
        email: 'sunita.agarwal@yahoo.com',
        passwordHash: 'password123',
        role: 'HOST',
        phone: '+91 90987 65432',
        walletBalance: 12300,
      },
      {
        name: 'Manoj Gupta',
        email: 'manoj.gupta@outlook.in',
        passwordHash: 'password123',
        role: 'HOST',
        phone: '+91 89876 54321',
        walletBalance: 6700,
      },
      {
        name: 'Anita Menon',
        email: 'anita.menon@gmail.com',
        passwordHash: 'password123',
        role: 'HOST',
        phone: '+91 88765 43210',
        walletBalance: 9800,
      },
      {
        name: 'Suresh Iyer',
        email: 'suresh.iyer@rediffmail.com',
        passwordHash: 'password123',
        role: 'HOST',
        phone: '+91 87654 32109',
        walletBalance: 15200,
      },
      {
        name: 'Pooja Joshi',
        email: 'pooja.joshi@icloud.com',
        passwordHash: 'password123',
        role: 'HOST',
        phone: '+91 86543 21098',
        walletBalance: 7400,
      },
      {
        name: 'Karthik Rao',
        email: 'karthik.rao@proton.me',
        passwordHash: 'password123',
        role: 'HOST',
        phone: '+91 85432 10987',
        walletBalance: 11900,
      },
    ]);

    logger.info(`✅ Created ${drivers.length} drivers and ${hosts.length} hosts\n`);

    // ===== CREATE 15 CHARGERS IN MYSORE REGION =====
    logger.info('🔌 Creating 15 chargers in Mysore region (ML compatible coordinates)...');

    const chargers = await Charger.create([
      {
        chargerId: 'CHG-MYS-001', // ML-compatible ID
        owner: hosts[0]._id,
        title: 'Mysore Palace Visitor Parking',
        description: 'Premium charging near iconic Mysore Palace. Level 2 AC charger with heritage view.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 30,
        pricePerKwh: 18,
        hostType: 'Business Host',
        amenities: ['Tourist Area', 'WiFi', 'Restroom', 'CCTV'],
        location: {
          address: 'Sayyaji Rao Road, Palace East Gate',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570001',
          country: 'India',
          type: 'Point',
          coordinates: [76.6552, 12.3051], // [lng, lat]
        },
        rating: 4.8,
        totalRatings: 23,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-002', // ML-compatible ID
        owner: hosts[1]._id,
        title: 'Chamundi Hills Temple Charger',
        description: 'Scenic hilltop charging at Chamundi Hills. Enjoy temple darshan while charging.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 11,
        pricePerHour: 35,
        pricePerKwh: 21,
        hostType: 'Business Host',
        amenities: ['Scenic View', 'Temple', 'Cafe', 'Covered Parking'],
        location: {
          address: 'Chamundi Hills Road, Temple Parking',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570008',
          country: 'India',
          type: 'Point',
          coordinates: [76.6727, 12.2725],
        },
        rating: 4.9,
        totalRatings: 31,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-003', // ML-compatible ID
        owner: hosts[2]._id,
        title: 'KRS Dam Fast Charger',
        description: 'DC Fast Charger at KRS Dam. Perfect for tourists visiting Brindavan Gardens.',
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
          coordinates: [76.5749, 12.4258],
        },
        rating: 4.9,
        totalRatings: 47,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-004', // ML-compatible ID
        owner: hosts[3]._id,
        title: 'Infosys Campus Gate Charger',
        description: 'IT campus area charger. Ideal for professionals and visitors to Infosys Mysore.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 28,
        pricePerKwh: 17,
        hostType: 'Business Host',
        amenities: ['Corporate Area', 'WiFi', 'Security', 'Covered Parking'],
        location: {
          address: 'Ring Road, Infosys Campus Gate',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570027',
          country: 'India',
          type: 'Point',
          coordinates: [76.6394, 12.3118],
        },
        rating: 4.7,
        totalRatings: 28,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-005', // ML-compatible ID
        owner: hosts[4]._id,
        title: 'Mall of Mysore B1 Parking',
        description: 'Premium underground mall parking charger. Shop while you charge!',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 11,
        pricePerHour: 32,
        pricePerKwh: 19,
        hostType: 'Business Host',
        amenities: ['Shopping Mall', 'Food Court', 'Cinema', 'WiFi'],
        location: {
          address: 'MG Road, Mall B1 Level',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570001',
          country: 'India',
          type: 'Point',
          coordinates: [76.6394, 12.3060],
        },
        rating: 4.8,
        totalRatings: 39,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-006', // ML-compatible ID
        owner: hosts[5]._id,
        title: 'Railway Station P2P Host',
        description: 'Convenient P2P host near Mysore Railway Station. Traveler-friendly.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 25,
        pricePerKwh: 15,
        hostType: 'Home P2P Host',
        amenities: ['Railway Nearby', 'CCTV', 'Covered Parking'],
        location: {
          address: 'JLB Road, Near Station',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570001',
          country: 'India',
          type: 'Point',
          coordinates: [76.6512, 12.3077],
        },
        rating: 4.6,
        totalRatings: 18,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-007', // ML-compatible ID
        owner: hosts[6]._id,
        title: 'Brindavan Gardens Charger',
        description: 'Charge while enjoying the famous musical fountain show at Brindavan Gardens.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 11,
        pricePerHour: 35,
        pricePerKwh: 21,
        hostType: 'Business Host',
        amenities: ['Garden', 'Tourist Spot', 'Restaurant', 'WiFi'],
        location: {
          address: 'Brindavan Gardens, KRS Road',
          city: 'Srirangapatna',
          state: 'Karnataka',
          zipCode: '571606',
          country: 'India',
          type: 'Point',
          coordinates: [76.5714, 12.4244],
        },
        rating: 4.9,
        totalRatings: 34,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-008', // ML-compatible ID
        owner: hosts[0]._id,
        title: 'Gokulam Yoga Hub Charger',
        description: 'Peaceful Gokulam residential charger. Yoga capital of India neighborhood.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 26,
        pricePerKwh: 16,
        hostType: 'Home P2P Host',
        amenities: ['Residential', 'Quiet', 'WiFi', 'Covered Parking'],
        location: {
          address: 'Contour Road, Gokulam 3rd Stage',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570002',
          country: 'India',
          type: 'Point',
          coordinates: [76.6231, 12.3134],
        },
        rating: 4.8,
        totalRatings: 22,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-009', // ML-compatible ID
        owner: hosts[1]._id,
        title: 'University of Mysore Campus',
        description: 'Academic campus charger near Crawford Hall. Student and faculty friendly.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 24,
        pricePerKwh: 14,
        hostType: 'Business Host',
        amenities: ['Campus', 'WiFi', 'Library', 'Cafeteria'],
        location: {
          address: 'Crawford Hall Road, University',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570005',
          country: 'India',
          type: 'Point',
          coordinates: [76.6394, 12.3117],
        },
        rating: 4.7,
        totalRatings: 15,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-010', // ML-compatible ID
        owner: hosts[2]._id,
        title: 'Devaraja Market Area Host',
        description: 'Residential host near bustling Devaraja Market. Great for shoppers.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 27,
        pricePerKwh: 16,
        hostType: 'Home P2P Host',
        amenities: ['Market', 'Local Shopping', 'CCTV'],
        location: {
          address: 'Dhanvanthri Road, Near Market',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570001',
          country: 'India',
          type: 'Point',
          coordinates: [76.6561, 12.3073],
        },
        rating: 4.6,
        totalRatings: 12,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-011', // ML-compatible ID
        owner: hosts[3]._id,
        title: 'Mysore Zoo Visitor Station',
        description: 'Family-friendly charger at Sri Chamarajendra Zoological Gardens.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 11,
        pricePerHour: 32,
        pricePerKwh: 19,
        hostType: 'Business Host',
        amenities: ['Zoo', 'Family Friendly', 'Food Stalls', 'WiFi'],
        location: {
          address: 'Zoo Main Road, Indiranagar',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570010',
          country: 'India',
          type: 'Point',
          coordinates: [76.6648, 12.3015],
        },
        rating: 4.8,
        totalRatings: 28,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-012', // ML-compatible ID
        owner: hosts[4]._id,
        title: 'Jayalakshmipuram Premium P2P',
        description: 'Gated community charger in premium Jayalakshmipuram locality.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 28,
        pricePerKwh: 17,
        hostType: 'Home P2P Host',
        amenities: ['Gated Community', 'WiFi', 'CCTV', 'Covered Parking'],
        location: {
          address: 'Mandi Mohalla, Jayalakshmipuram',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570012',
          country: 'India',
          type: 'Point',
          coordinates: [76.6211, 12.3214],
        },
        rating: 4.9,
        totalRatings: 19,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-013', // ML-compatible ID
        owner: hosts[5]._id,
        title: 'NH-275 Highway Service Plaza',
        description: 'DC Fast Charger on Bangalore-Mysore highway. Perfect for long-distance travelers.',
        chargerType: 'DC Fast',
        connectorType: 'CCS2',
        powerOutput: 60,
        pricePerHour: 55,
        pricePerKwh: 26,
        hostType: 'Business Host',
        amenities: ['Highway', 'Restaurant', 'Restroom', 'Store', 'WiFi'],
        location: {
          address: 'NH-275, Srirangapatna Bypass',
          city: 'Srirangapatna',
          state: 'Karnataka',
          zipCode: '571438',
          country: 'India',
          type: 'Point',
          coordinates: [76.6850, 12.4150],
        },
        rating: 4.9,
        totalRatings: 42,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-014', // ML-compatible ID
        owner: hosts[6]._id,
        title: 'Kukkarahalli Lake Scenic Charger',
        description: 'Beautiful lakeside charger. Enjoy bird watching and jogging while charging.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 11,
        pricePerHour: 30,
        pricePerKwh: 18,
        hostType: 'Business Host',
        amenities: ['Lake View', 'Jogging Track', 'Bird Watching', 'Peaceful'],
        location: {
          address: 'Bogadi 2nd Stage, Lake Road',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570026',
          country: 'India',
          type: 'Point',
          coordinates: [76.6273, 12.3173],
        },
        rating: 4.8,
        totalRatings: 25,
        isAvailable: true,
        isActive: true,
      },
      {
        chargerId: 'CHG-MYS-015', // ML-compatible ID
        owner: hosts[0]._id,
        title: 'CFTRI Research Area Charger',
        description: 'Research institute area charger near CFTRI and Lingambudhi Lake.',
        chargerType: 'Level 2',
        connectorType: 'Type 2',
        powerOutput: 7.4,
        pricePerHour: 27,
        pricePerKwh: 16,
        hostType: 'Business Host',
        amenities: ['Research Area', 'Lake Nearby', 'WiFi', 'Parking'],
        location: {
          address: 'CFTRI Layout, Near Lake',
          city: 'Mysore',
          state: 'Karnataka',
          zipCode: '570020',
          country: 'India',
          type: 'Point',
          coordinates: [76.6489, 12.2887],
        },
        rating: 4.7,
        totalRatings: 17,
        isAvailable: true,
        isActive: true,
      },
    ]);

    logger.info(`✅ Created ${chargers.length} chargers in Mysore region`);

    // Add images to chargers
    const chargerImages = [
      '/uploads/1.jpg',
      '/uploads/2.jpg',
      '/uploads/3.jpg',
      '/uploads/4.jpeg',
      '/uploads/5.jpg',
    ];
    
    for (let i = 0; i < chargers.length; i++) {
      const imageIndex = i % chargerImages.length;
      chargers[i].images = [chargerImages[imageIndex]];
      await chargers[i].save();
    }
    logger.info(`✅ Added images to all chargers\n`);

    // ===== CREATE PRICING RECORDS =====
    logger.info('💰 Creating pricing configuration...');
    const pricingRecords = chargers.map(charger => ({
      charger: charger._id,
      basePricePerHour: charger.pricePerHour,
      surgeMultiplierWeight: 0.5,
      weekendMultiplier: 1.2,
      holidayMultiplier: 1.3,
      isDynamic: true,
    }));
    await Pricing.create(pricingRecords);
    logger.info(`✅ Created ${pricingRecords.length} pricing configs\n`);

    // ===== GENERATE AVAILABLE SLOTS FOR ALL CHARGERS =====
    logger.info('🕒 Generating available slots (Sep 23-28) for all chargers...');

    const slotsToCreate = [];
    const startSlotDate = new Date(2026, 8, 23, 0, 0, 0, 0); // Sep 23, 2026
    const endSlotDate = new Date(2026, 8, 29, 0, 0, 0, 0); // Sep 29, 2026
    const slotDuration = 2; // 2-hour slots
    const dailyStartHour = 6; // 6 AM
    const dailyEndHour = 22; // 10 PM

    for (const charger of chargers) {
      const currentDate = new Date(startSlotDate);
      
      while (currentDate < endSlotDate) {
        // Generate slots for this day
        for (let hour = dailyStartHour; hour < dailyEndHour; hour += slotDuration) {
          const slotStart = new Date(currentDate);
          slotStart.setHours(hour, 0, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setHours(hour + slotDuration, 0, 0, 0);

          slotsToCreate.push({
            charger: charger._id,
            startTime: slotStart,
            endTime: slotEnd,
            price: charger.pricePerHour || 25,
            status: 'available', // Will be updated to 'occupied' by bookings
          });
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    await Slot.create(slotsToCreate);
    logger.info(`✅ Created ${slotsToCreate.length} slots across all chargers\n`);

    // ===== CREATE BOOKINGS (Sep 23-28, ALIGNED WITH 2-HOUR SLOTS) =====
    logger.info('📅 Creating bookings from Sep 23-28 aligned with slot grid...');

    const createDate = (day, hour, minute = 0) => {
      return new Date(2026, 8, day, hour, minute, 0, 0); // Month 8 = September
    };

    // Bookings MUST align with 2-hour slot grid: 6AM, 8AM, 10AM, 12PM, 2PM, 4PM, 6PM, 8PM
    const bookingData = [
      // Sep 23 - Past completed (aligned to 2-hour slots)
      { driver: 0, charger: 0, host: 0, start: createDate(23, 8, 0), duration: 2, status: 'COMPLETED' },
      { driver: 1, charger: 1, host: 1, start: createDate(23, 10, 0), duration: 2, status: 'COMPLETED' },
      { driver: 2, charger: 2, host: 2, start: createDate(23, 14, 0), duration: 2, status: 'COMPLETED' },
      { driver: 3, charger: 3, host: 3, start: createDate(23, 16, 0), duration: 2, status: 'COMPLETED' },
      { driver: 4, charger: 4, host: 4, start: createDate(23, 18, 0), duration: 2, status: 'COMPLETED' },
      { driver: 5, charger: 5, host: 5, start: createDate(23, 6, 0), duration: 2, status: 'COMPLETED' },
      { driver: 6, charger: 6, host: 6, start: createDate(23, 12, 0), duration: 2, status: 'COMPLETED' },
      { driver: 7, charger: 7, host: 0, start: createDate(23, 20, 0), duration: 2, status: 'COMPLETED' },

      // Sep 24 - Past completed
      { driver: 0, charger: 8, host: 1, start: createDate(24, 6, 0), duration: 2, status: 'COMPLETED' },
      { driver: 1, charger: 9, host: 2, start: createDate(24, 8, 0), duration: 2, status: 'COMPLETED' },
      { driver: 2, charger: 10, host: 3, start: createDate(24, 12, 0), duration: 2, status: 'COMPLETED' },
      { driver: 3, charger: 11, host: 4, start: createDate(24, 14, 0), duration: 2, status: 'COMPLETED' },
      { driver: 4, charger: 12, host: 5, start: createDate(24, 18, 0), duration: 2, status: 'COMPLETED' },
      { driver: 5, charger: 13, host: 6, start: createDate(24, 10, 0), duration: 2, status: 'COMPLETED' },
      { driver: 6, charger: 14, host: 0, start: createDate(24, 16, 0), duration: 2, status: 'COMPLETED' },

      // Sep 25 - TODAY (mix of completed & confirmed)
      { driver: 7, charger: 0, host: 0, start: createDate(25, 6, 0), duration: 2, status: 'COMPLETED' },
      { driver: 0, charger: 1, host: 1, start: createDate(25, 10, 0), duration: 2, status: 'COMPLETED' },
      { driver: 1, charger: 2, host: 2, start: createDate(25, 14, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 2, charger: 4, host: 4, start: createDate(25, 16, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 3, charger: 5, host: 5, start: createDate(25, 18, 0), duration: 2, status: 'CONFIRMED' },

      // Sep 26 - Upcoming
      { driver: 4, charger: 3, host: 3, start: createDate(26, 8, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 5, charger: 6, host: 6, start: createDate(26, 10, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 6, charger: 7, host: 0, start: createDate(26, 14, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 7, charger: 8, host: 1, start: createDate(26, 16, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 0, charger: 9, host: 2, start: createDate(26, 18, 0), duration: 2, status: 'CONFIRMED' },

      // Sep 27 - Upcoming
      { driver: 1, charger: 10, host: 3, start: createDate(27, 6, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 2, charger: 11, host: 4, start: createDate(27, 12, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 3, charger: 0, host: 0, start: createDate(27, 14, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 4, charger: 12, host: 5, start: createDate(27, 8, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 5, charger: 13, host: 6, start: createDate(27, 18, 0), duration: 2, status: 'CONFIRMED' },

      // Sep 28 - Upcoming
      { driver: 6, charger: 14, host: 0, start: createDate(28, 6, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 7, charger: 1, host: 1, start: createDate(28, 10, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 0, charger: 3, host: 3, start: createDate(28, 12, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 1, charger: 4, host: 4, start: createDate(28, 16, 0), duration: 2, status: 'CONFIRMED' },
      { driver: 2, charger: 6, host: 6, start: createDate(28, 20, 0), duration: 2, status: 'CONFIRMED' },
    ];

    const bookings = [];
    const payments = [];
    const sessions = [];
    const reviews = [];

    for (const data of bookingData) {
      const driver = drivers[data.driver];
      const charger = chargers[data.charger];
      const host = hosts[data.host];
      const endTime = new Date(data.start.getTime() + data.duration * 3600 * 1000);
      const totalPrice = Math.round(charger.pricePerHour * data.duration);

      // Find the exact slot that matches this booking time
      const matchingSlot = await Slot.findOne({
        charger: charger._id,
        startTime: data.start,
        endTime: endTime,
      });

      const booking = await Booking.create({
        driver: driver._id,
        charger: charger._id,
        host: host._id,
        slot: matchingSlot?._id || null,
        startTime: data.start,
        endTime: endTime,
        totalPrice,
        status: data.status,
        paymentStatus: 'PAID',
        paymentReceiptId: `RZP-${Math.random().toString(36).substring(7).toUpperCase()}`,
        pricingSnapshot: {
          pricePerHour: charger.pricePerHour,
          surgeMultiplier: 1.0,
          appliedRules: ['BASE_RATE', 'ML_SURGE'],
        },
        expiresAt: new Date(endTime.getTime() + 86400 * 1000),
      });

      bookings.push(booking);

      // Mark the slot as occupied and link to booking
      if (matchingSlot) {
        matchingSlot.status = 'occupied';
        matchingSlot.booking = booking._id;
        await matchingSlot.save();
      }

      // Payment
      payments.push({
        booking: booking._id,
        user: driver._id,
        amount: totalPrice,
        type: 'DEBIT',
        currency: 'INR',
        razorpayOrderId: `order_${Math.random().toString(36).substring(7)}`,
        razorpayPaymentId: `pay_${Math.random().toString(36).substring(7)}`,
        status: 'VERIFIED',
        paymentMode: 'razorpay',
      });

      // Sessions and reviews for completed bookings
      if (data.status === 'COMPLETED') {
        const energyConsumed = (data.duration * charger.powerOutput * (0.85 + Math.random() * 0.1)).toFixed(2);
        sessions.push({
          driver: driver._id,
          charger: charger._id,
          booking: booking._id,
          startTime: data.start,
          endTime: endTime,
          energyConsumedKwh: parseFloat(energyConsumed),
          pricePerKwh: charger.pricePerKwh || 15,
          totalCost: totalPrice,
          status: 'COMPLETED',
          telemetryMode: 'SIMULATION',
        });

        if (Math.random() > 0.3) {
          const reviewTexts = [
            'Excellent host! Charger worked perfectly.',
            'Great location, will book again.',
            'Clean setup, good amenities.',
            'Convenient and fair pricing.',
            'Smooth experience, highly recommended.',
          ];
          reviews.push({
            booking: booking._id,
            charger: charger._id,
            user: driver._id,
            rating: 4 + Math.floor(Math.random() * 2),
            comment: reviewTexts[Math.floor(Math.random() * reviewTexts.length)],
          });
        }
      }
    }

    await Payment.create(payments);
    await ChargingSession.create(sessions);
    await Review.create(reviews);

    logger.info(`✅ Created ${bookings.length} bookings, ${sessions.length} sessions, ${reviews.length} reviews\n`);

    // ===== CREATE ML DEMAND DATA (Mysore coordinates) =====
    logger.info('🤖 Creating ML-compatible demand data...');

    const demandData = [];
    for (const charger of chargers) {
      const [lng, lat] = charger.location.coordinates;

      for (let hour = 0; hour < 24; hour++) {
        let demandValue;
        if (hour >= 6 && hour < 9) demandValue = 0.7 + Math.random() * 0.2;
        else if (hour >= 9 && hour < 12) demandValue = 0.5 + Math.random() * 0.2;
        else if (hour >= 12 && hour < 14) demandValue = 0.6 + Math.random() * 0.15;
        else if (hour >= 14 && hour < 17) demandValue = 0.4 + Math.random() * 0.2;
        else if (hour >= 17 && hour < 21) demandValue = 0.75 + Math.random() * 0.2;
        else if (hour >= 21 && hour < 23) demandValue = 0.5 + Math.random() * 0.2;
        else demandValue = 0.1 + Math.random() * 0.2;

        demandData.push({
          charger: charger._id,
          latitude: lat,
          longitude: lng,
          hour,
          dayOfWeek: 2, // Wednesday
          month: 9, // September
          isWeekend: false,
          isHoliday: false,
          demandValue: Math.min(0.98, Math.max(0.05, demandValue)),
          provenance: 'SYNTHETIC_CALIBRATED',
          measurementType: 'OCCUPANCY_MINUTES',
          telemetrySource: 'CALIBRATED_SIMULATION',
          qualityStatus: 'VALID',
        });
      }
    }

    await DemandData.create(demandData);
    logger.info(`✅ Created ${demandData.length} ML demand records\n`);

    // ===== SUMMARY =====
    logger.info('\n🎉 SEEDING COMPLETED SUCCESSFULLY!\n');
    logger.info('📊 Summary:');
    logger.info(`   - Users: ${drivers.length + hosts.length} (${drivers.length} drivers, ${hosts.length} hosts)`);
    logger.info(`   - Chargers: ${chargers.length} (Mysore/Srirangapatna) with images`);
    logger.info(`   - Slots: ${slotsToCreate.length} (2-hour slots from 6 AM to 10 PM)`);
    logger.info(`   - Bookings: ${bookings.length} (Sep 23-28, 2026)`);
    logger.info(`   - Sessions: ${sessions.length}`);
    logger.info(`   - Reviews: ${reviews.length}`);
    logger.info(`   - Payments: ${payments.length}`);
    logger.info(`   - ML Demand Data: ${demandData.length}`);
    logger.info(`   - Pricing Configs: ${pricingRecords.length}`);
    logger.info('\n📍 Coordinates: Lat 12.2-12.5, Lon 76.5-76.7 (ML Model Compatible)');
    logger.info('✨ Your EVsathi demo is ready!\n');

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
if (process.argv[1] && process.argv[1].endsWith('seedRealisticDemo.js')) {
  seedRealisticDemo()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default seedRealisticDemo;
