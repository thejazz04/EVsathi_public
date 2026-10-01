import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User.js';
import Charger from '../models/Charger.js';
import Slot from '../models/Slot.js';
import Pricing from '../models/Pricing.js';
import { toGeoJSONPoint } from '../utils/geo.js';
import logger from '../utils/logger.js';
import { maskMongoUri } from '../config/db.js';

// Available images from uploads folder
const AVAILABLE_IMAGES = [
  '5.jpg',
  '4.jpeg',
  '3.jpg',
  '2.jpg',
  '1.jpg',
];

// Randomly select images for a charger
const getRandomImages = (count = 3) => {
  const shuffled = [...AVAILABLE_IMAGES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Mysore Charger Locations with accurate geo-coordinates
const mysoreChargers = [
  {
    title: 'Mysore Palace Visitor Parking',
    description: 'Fast charging station near the iconic Mysore Palace. Level 2 AC charger with ample parking space for tourists.',
    location: {
      address: 'Sayyaji Rao Road, Near Mysore Palace East Gate',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570001',
      country: 'India',
      // Mysore Palace coordinates
      coordinates: [76.6552, 12.3051],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 7.4,
    pricePerHour: 30,
    amenities: ['Tourist Area', 'WiFi', 'Restroom', 'CCTV Monitored'],
    hostType: 'Business Host',
  },
  {
    title: 'Chamundi Hills Viewpoint Charging',
    description: 'Scenic hilltop charging station at Chamundi Hills. Perfect for tourists visiting the temple with Level 2 charging.',
    location: {
      address: 'Chamundi Hills Road, Near Temple Parking',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570008',
      country: 'India',
      // Chamundi Hills coordinates
      coordinates: [76.6727, 12.2725],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 11,
    pricePerHour: 35,
    amenities: ['Scenic View', 'Temple Nearby', 'Covered Parking', 'Cafe'],
    hostType: 'Business Host',
  },
  {
    title: 'KRS Dam Visitor Center Fast Charger',
    description: 'DC Fast Charger at the famous Krishnaraja Sagar Dam tourist center. 50kW CCS2 charging for quick top-ups.',
    location: {
      address: 'KRS Road, Dam Visitor Complex',
      city: 'Srirangapatna',
      state: 'Karnataka',
      zipCode: '571438',
      country: 'India',
      // KRS Dam coordinates
      coordinates: [76.5749, 12.4258],
    },
    chargerType: 'DC Fast',
    connectorType: 'CCS2',
    powerOutput: 50,
    pricePerHour: 120,
    amenities: ['Tourist Spot', 'Restaurant', 'WiFi', 'Garden View'],
    hostType: 'Business Host',
  },
  {
    title: 'Infosys Mysore Campus Gate Charging',
    description: 'Public access Level 2 charger near Infosys campus gate. Ideal for IT professionals and visitors.',
    location: {
      address: 'Infosys Campus Road, Ring Road Junction',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570027',
      country: 'India',
      // Infosys Mysore coordinates
      coordinates: [76.6394, 12.3118],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 7.4,
    pricePerHour: 28,
    amenities: ['Corporate Area', 'WiFi', 'Covered Parking', '24/7 Security'],
    hostType: 'Business Host',
  },
  {
    title: 'Mall of Mysore Underground Parking',
    description: 'Premium underground parking Level 2 charging station at Mall of Mysore. Shop while you charge!',
    location: {
      address: 'MG Road, Mall of Mysore B1 Parking',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570001',
      country: 'India',
      // Mall of Mysore coordinates
      coordinates: [76.6394, 12.3060],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 11,
    pricePerHour: 32,
    amenities: ['Shopping Mall', 'Food Court', 'Cinema', 'WiFi', 'Covered Parking'],
    hostType: 'Business Host',
  },
  {
    title: 'Mysore Railway Station P2P Host',
    description: 'Residential P2P host near Railway Station. Convenient for travelers with secure driveway parking.',
    location: {
      address: 'JLB Road, Near Railway Station',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570001',
      country: 'India',
      // Railway Station coordinates
      coordinates: [76.6512, 12.3077],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 7.4,
    pricePerHour: 25,
    amenities: ['Railway Station Nearby', 'CCTV', 'Covered Parking'],
    hostType: 'Home P2P Host',
  },
  {
    title: 'Brindavan Gardens Light & Sound Show Parking',
    description: 'Charging station at the famous Brindavan Gardens. Enjoy the musical fountain while your EV charges.',
    location: {
      address: 'Brindavan Gardens, KRS Road',
      city: 'Srirangapatna',
      state: 'Karnataka',
      zipCode: '571606',
      country: 'India',
      // Brindavan Gardens coordinates
      coordinates: [76.5714, 12.4244],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 11,
    pricePerHour: 35,
    amenities: ['Garden View', 'Tourist Attraction', 'Restaurant', 'WiFi'],
    hostType: 'Business Host',
  },
  {
    title: 'Gokulam Residential Community Charger',
    description: 'Residential community P2P charger in peaceful Gokulam area. Yoga capital neighborhood with excellent facilities.',
    location: {
      address: 'Contour Road, Gokulam 3rd Stage',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570002',
      country: 'India',
      // Gokulam coordinates
      coordinates: [76.6231, 12.3134],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 7.4,
    pricePerHour: 26,
    amenities: ['Residential Area', 'Quiet Neighborhood', 'WiFi', 'Covered Parking'],
    hostType: 'Home P2P Host',
  },
  {
    title: 'University of Mysore Campus Charger',
    description: 'Academic campus charging point near Crawford Hall. Available for students, faculty, and visitors.',
    location: {
      address: 'Crawford Hall Road, University Campus',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570005',
      country: 'India',
      // University of Mysore coordinates
      coordinates: [76.6394, 12.3117],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 7.4,
    pricePerHour: 24,
    amenities: ['University Campus', 'WiFi', 'Library Nearby', 'Cafeteria'],
    hostType: 'Business Host',
  },
  {
    title: 'Devaraja Market P2P Nearby Host',
    description: 'Convenient residential host near the bustling Devaraja Market. Perfect for market visitors.',
    location: {
      address: 'Dhanvanthri Road, Near Devaraja Market',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570001',
      country: 'India',
      // Devaraja Market coordinates
      coordinates: [76.6561, 12.3073],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 7.4,
    pricePerHour: 27,
    amenities: ['Market Nearby', 'Local Shopping', 'CCTV', 'Street Parking'],
    hostType: 'Home P2P Host',
  },
  {
    title: 'Mysore Zoo Visitor Parking Station',
    description: 'Fast charging station at Sri Chamarajendra Zoological Gardens. Great for families visiting the zoo.',
    location: {
      address: 'Zoo Main Road, Indiranagar',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570010',
      country: 'India',
      // Mysore Zoo coordinates
      coordinates: [76.6648, 12.3015],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 11,
    pricePerHour: 32,
    amenities: ['Zoo Nearby', 'Family Friendly', 'Food Stalls', 'WiFi'],
    hostType: 'Business Host',
  },
  {
    title: 'Jayalakshmipuram Residential P2P',
    description: 'Home P2P host in premium Jayalakshmipuram locality. Safe gated community with covered parking.',
    location: {
      address: 'Mandi Mohalla Main Road, Jayalakshmipuram',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570012',
      country: 'India',
      // Jayalakshmipuram coordinates
      coordinates: [76.6211, 12.3214],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 7.4,
    pricePerHour: 28,
    amenities: ['Gated Community', 'Covered Parking', 'WiFi', 'CCTV'],
    hostType: 'Home P2P Host',
  },
  {
    title: 'Bangalore-Mysore Highway Service Plaza',
    description: 'Highway DC Fast Charger on NH-275. Perfect stop for long-distance travelers between Bangalore and Mysore.',
    location: {
      address: 'NH-275, Srirangapatna Bypass',
      city: 'Srirangapatna',
      state: 'Karnataka',
      zipCode: '571438',
      country: 'India',
      // Highway Service Plaza coordinates
      coordinates: [76.6850, 12.4150],
    },
    chargerType: 'DC Fast',
    connectorType: 'CCS2',
    powerOutput: 60,
    pricePerHour: 140,
    amenities: ['Highway Stop', 'Restaurant', 'Restroom', 'Convenience Store', 'WiFi'],
    hostType: 'Business Host',
  },
  {
    title: 'Hunsur Road Suburban Charger',
    description: 'Suburban residential P2P host on Hunsur Road. Peaceful location with easy highway access.',
    location: {
      address: 'Hunsur Main Road, Hinkal',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570017',
      country: 'India',
      // Hunsur Road coordinates
      coordinates: [76.5893, 12.3336],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 7.4,
    pricePerHour: 24,
    amenities: ['Suburban Area', 'Quiet', 'Covered Parking', 'Pet Friendly'],
    hostType: 'Home P2P Host',
  },
  {
    title: 'Kukkarahalli Lake Jogging Track Charger',
    description: 'Scenic charging point near Kukkarahalli Lake. Enjoy morning/evening walks while your EV charges.',
    location: {
      address: 'Bogadi 2nd Stage, Kukkarahalli Lake Road',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570026',
      country: 'India',
      // Kukkarahalli Lake coordinates
      coordinates: [76.6273, 12.3173],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 11,
    pricePerHour: 30,
    amenities: ['Lake View', 'Jogging Track', 'Bird Watching', 'Peaceful'],
    hostType: 'Business Host',
  },
  {
    title: 'Lingambudhi Lake Near CFTRI Charger',
    description: 'Research institute area charging station. Close to CFTRI and Lingambudhi Lake scenic spot.',
    location: {
      address: 'CFTRI Layout, Near Lingambudhi Lake',
      city: 'Mysore',
      state: 'Karnataka',
      zipCode: '570020',
      country: 'India',
      // CFTRI/Lingambudhi coordinates
      coordinates: [76.6489, 12.2887],
    },
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: 7.4,
    pricePerHour: 27,
    amenities: ['Research Area', 'Lake Nearby', 'WiFi', 'Covered Parking'],
    hostType: 'Business Host',
  },
];

export const seedMysoreChargers = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/evsathi';
    if (mongoose.connection.readyState !== 1) {
      logger.info(`Connecting to MongoDB for Mysore seeding: ${maskMongoUri(mongoUri)}`);
      await mongoose.connect(mongoUri, { autoIndex: true });
    }

    logger.info('Seeding Mysore area chargers with random images...');

    // Create demo host users for Mysore chargers (skip if already exist)
    let hostUsers = await User.find({
      email: {
        $in: [
          'rajesh.host@evsathi.in',
          'priya.host@evsathi.in',
          'suresh.host@evsathi.in',
          'lakshmi.host@evsathi.in',
        ],
      },
    });

    if (hostUsers.length === 0) {
      hostUsers = await User.create([
        {
          name: 'Rajesh Kumar',
          email: 'rajesh.host@evsathi.in',
          passwordHash: 'mysorehost123',
          role: 'owner',
          phone: '+91 98450 12345',
          walletBalance: 5000,
        },
        {
          name: 'Priya Sharma',
          email: 'priya.host@evsathi.in',
          passwordHash: 'mysorehost123',
          role: 'owner',
          phone: '+91 98451 67890',
          walletBalance: 4200,
        },
        {
          name: 'Suresh Gowda',
          email: 'suresh.host@evsathi.in',
          passwordHash: 'mysorehost123',
          role: 'owner',
          phone: '+91 98452 98765',
          walletBalance: 3800,
        },
        {
          name: 'Lakshmi Venkatesh',
          email: 'lakshmi.host@evsathi.in',
          passwordHash: 'mysorehost123',
          role: 'owner',
          phone: '+91 98453 54321',
          walletBalance: 4500,
        },
      ]);
      logger.info(`Created ${hostUsers.length} demo host users for Mysore area`);
    } else {
      logger.info(`Found ${hostUsers.length} existing host users for Mysore area`);
    }

    // Create chargers with random images and owners
    const createdChargers = [];
    for (let i = 0; i < mysoreChargers.length; i++) {
      const chargerData = mysoreChargers[i];
      const randomOwner = hostUsers[Math.floor(Math.random() * hostUsers.length)];
      const images = getRandomImages(Math.floor(Math.random() * 3) + 1); // 1-3 images per charger

      const charger = await Charger.create({
        owner: randomOwner._id,
        title: chargerData.title,
        description: chargerData.description,
        chargerType: chargerData.chargerType,
        connectorType: chargerData.connectorType,
        powerOutput: chargerData.powerOutput,
        pricePerHour: chargerData.pricePerHour,
        pricePerKwh: Math.round(chargerData.pricePerHour * 0.6), // Derive kWh price
        hostType: chargerData.hostType,
        amenities: chargerData.amenities,
        images: images, // Random images from uploads folder
        location: {
          address: chargerData.location.address,
          city: chargerData.location.city,
          state: chargerData.location.state,
          zipCode: chargerData.location.zipCode,
          country: chargerData.location.country,
          type: 'Point',
          // GeoJSON format: [longitude, latitude]
          // chargerData.location.coordinates is already [lng, lat]
          coordinates: toGeoJSONPoint(
            chargerData.location.coordinates[0], // longitude (76.x for Mysore)
            chargerData.location.coordinates[1]  // latitude (12.x for Mysore)
          ).coordinates,
        },
        rating: (4.0 + Math.random() * 1).toFixed(1), // Random rating 4.0-5.0
        totalRatings: Math.floor(Math.random() * 50) + 5, // 5-55 ratings
        isAvailable: true,
        isActive: true,
      });

      createdChargers.push(charger);

      // Create available slots for next 48 hours
      const slots = [];
      const now = new Date();
      for (let day = 0; day < 2; day++) {
        for (let hour = 6; hour <= 22; hour += 2) {
          const startTime = new Date(now);
          startTime.setDate(now.getDate() + day);
          startTime.setHours(hour, 0, 0, 0);

          const endTime = new Date(startTime);
          endTime.setHours(hour + 2);

          slots.push({
            charger: charger._id,
            startTime,
            endTime,
            price: chargerData.pricePerHour * 2, // 2-hour slot
            status: 'available',
          });
        }
      }

      await Slot.create(slots);

      // Create pricing configuration
      await Pricing.create({
        charger: charger._id,
        basePricePerHour: chargerData.pricePerHour,
        surgeMultiplierWeight: 0.5,
        weekendMultiplier: 1.2,
        holidayMultiplier: 1.3,
        isDynamic: true,
      });

      logger.info(`Created charger: ${charger.title} with ${images.length} images and ${slots.length} slots`);
    }

    logger.info(`✅ Successfully seeded ${createdChargers.length} chargers in Mysore area!`);
    logger.info(`📍 Locations: Mysore Palace, Chamundi Hills, KRS Dam, Infosys Campus, Mall of Mysore, and more`);
    logger.info(`🖼️ Random images assigned from uploads folder`);
    
    return createdChargers;
  } catch (err) {
    logger.error('Mysore seed error', { error: err.message, stack: err.stack });
    throw err;
  }
};

// Run seed if called directly
if (process.argv[1] && process.argv[1].endsWith('seedMysore.js')) {
  seedMysoreChargers()
    .then(() => {
      logger.info('Mysore seeding completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Mysore seeding failed', { error: err.message });
      process.exit(1);
    });
}

export default seedMysoreChargers;
