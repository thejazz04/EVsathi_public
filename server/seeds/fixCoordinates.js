import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Charger from '../models/Charger.js';
import logger from '../utils/logger.js';
import { maskMongoUri } from '../config/db.js';

/**
 * Fix swapped coordinates in existing chargers
 * Mysore coordinates should be around: longitude 76.x, latitude 12.x
 * If they're swapped, they'll appear in Greenland or wrong locations
 */
export const fixChargerCoordinates = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/evsathi';
    if (mongoose.connection.readyState !== 1) {
      logger.info(`Connecting to MongoDB: ${maskMongoUri(mongoUri)}`);
      await mongoose.connect(mongoUri, { autoIndex: true });
    }

    logger.info('Checking chargers for coordinate issues...');

    const chargers = await Charger.find({});
    let fixedCount = 0;
    let skippedCount = 0;

    for (const charger of chargers) {
      const coords = charger.location?.coordinates;
      
      if (!coords || coords.length !== 2) {
        logger.warn(`Skipping charger ${charger._id}: No valid coordinates`);
        skippedCount++;
        continue;
      }

      const [lng, lat] = coords;

      // Check if coordinates are swapped
      // Mysore: lng should be ~76.x, lat should be ~12.x
      // Bangalore: lng should be ~77.x, lat should be ~12-13.x
      // If lng is 12.x and lat is 76-77.x, they're swapped!
      
      const looksSwapped = (
        (lng >= 12 && lng <= 13 && lat >= 76 && lat <= 78) || // Mysore/Bangalore swapped
        (lng >= -90 && lng <= 90 && Math.abs(lng) < 20 && lat >= 60 && lat <= 90) // Generic: lat-like in lng position
      );

      if (looksSwapped) {
        logger.warn(`Found swapped coordinates in ${charger.title}:`);
        logger.warn(`  Current: [${lng}, ${lat}] (WRONG - will show in wrong location)`);
        logger.warn(`  Fixed:   [${lat}, ${lng}] (CORRECT - GeoJSON format)`);

        // Swap the coordinates
        charger.location.coordinates = [lat, lng];
        await charger.save();

        fixedCount++;
        logger.info(`✓ Fixed coordinates for: ${charger.title}`);
      } else {
        // Coordinates look correct
        const city = charger.location?.city || '';
        if (city.toLowerCase().includes('mysore') || city.toLowerCase().includes('mysuru')) {
          // Verify Mysore coordinates are in valid range
          if (lng < 76 || lng > 77 || lat < 12 || lat > 13) {
            logger.warn(`Mysore charger has unusual coordinates: ${charger.title}`);
            logger.warn(`  Coordinates: [${lng}, ${lat}]`);
            logger.warn(`  Expected: lng 76-77, lat 12-13`);
          }
        }
        skippedCount++;
      }
    }

    logger.info('');
    logger.info('='.repeat(60));
    logger.info(`✓ Coordinate fix complete!`);
    logger.info(`  Fixed: ${fixedCount} chargers`);
    logger.info(`  Skipped: ${skippedCount} chargers (already correct)`);
    logger.info('='.repeat(60));

    if (fixedCount > 0) {
      logger.info('');
      logger.info('Next steps:');
      logger.info('1. Restart your backend server');
      logger.info('2. Hard refresh browser (Ctrl+Shift+R)');
      logger.info('3. Check map - chargers should now appear in Mysore!');
    }

    return { fixed: fixedCount, skipped: skippedCount };
  } catch (err) {
    logger.error('Coordinate fix error', { error: err.message, stack: err.stack });
    throw err;
  }
};

// Run fix if called directly
if (process.argv[1] && process.argv[1].endsWith('fixCoordinates.js')) {
  fixChargerCoordinates()
    .then(() => {
      logger.info('Coordinate fix completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Coordinate fix failed', { error: err.message });
      process.exit(1);
    });
}

export default fixChargerCoordinates;
