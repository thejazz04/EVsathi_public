import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { connectDB } from '../config/db.js';
import Charger from '../models/Charger.js';
import Slot from '../models/Slot.js';
import Booking from '../models/Booking.js';
import Pricing from '../models/Pricing.js';

const OBSOLETE_TITLES = [
  'CHG-PHASE10-001',
  'CHG-PHASE11-001',
  'CHG-PHASE12-001',
  'CHG-NCR-001',
];

async function removeObsoleteChargers() {
  await connectDB();

  console.log('====================================================');
  console.log('REMOVING OBSOLETE SYNTHETIC TEST CHARGERS FROM MONGO');
  console.log('====================================================\n');

  const obsoleteChargers = await Charger.find({
    title: { $in: OBSOLETE_TITLES },
  });

  console.log(`Found ${obsoleteChargers.length} obsolete test charger(s) matching specified titles.`);

  for (const c of obsoleteChargers) {
    console.log(`\n- Removing charger: ${c._id} | Title: "${c.title}" | City: ${c.location?.city}`);
    const slotRes = await Slot.deleteMany({ charger: c._id });
    console.log(`  Deleted ${slotRes.deletedCount} associated slot(s)`);
    const bookingRes = await Booking.deleteMany({ charger: c._id });
    console.log(`  Deleted ${bookingRes.deletedCount} associated booking(s)`);
    const pricingRes = await Pricing.deleteMany({ charger: c._id });
    console.log(`  Deleted ${pricingRes.deletedCount} associated pricing record(s)`);
    await Charger.deleteOne({ _id: c._id });
    console.log(`  Deleted charger record.`);
  }

  const remaining = await Charger.find({}).sort({ createdAt: 1 }).lean();
  console.log(`\n====================================================`);
  console.log(`Total remaining active chargers in database: ${remaining.length}`);
  console.log('====================================================');
  remaining.forEach((c, idx) => {
    console.log(`${idx + 1}. ${c._id} | ${c.title} | ${c.location?.city || 'N/A'}`);
  });

  process.exit(0);
}

removeObsoleteChargers().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
