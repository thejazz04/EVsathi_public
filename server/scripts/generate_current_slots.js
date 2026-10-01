import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { connectDB } from '../config/db.js';
import Charger from '../models/Charger.js';
import Slot from '../models/Slot.js';

async function generateUpcomingSlots() {
  await connectDB();
  const chargers = await Charger.find({});
  const now = new Date();
  let totalCreated = 0;

  for (const c of chargers) {
    const slots = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 8; hour <= 20; hour += 2) {
        const start = new Date(now);
        start.setDate(now.getDate() + day);
        start.setHours(hour, 0, 0, 0);

        const end = new Date(start);
        end.setHours(hour + 2, 0, 0, 0);

        // Check if a slot already overlaps
        const exists = await Slot.findOne({
          charger: c._id,
          startTime: { $lt: end },
          endTime: { $gt: start },
        });

        if (!exists) {
          slots.push({
            charger: c._id,
            startTime: start,
            endTime: end,
            price: (c.pricePerHour || 30) * 2,
            status: 'available',
          });
        }
      }
    }
    if (slots.length > 0) {
      await Slot.create(slots);
      totalCreated += slots.length;
    }
  }

  console.log(`Generated ${totalCreated} upcoming bookable slots across ${chargers.length} chargers.`);
  process.exit(0);
}

generateUpcomingSlots().catch(err => {
  console.error(err);
  process.exit(1);
});
