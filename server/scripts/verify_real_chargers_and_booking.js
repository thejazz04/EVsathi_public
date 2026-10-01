import axios from 'axios';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';

const obsoleteIds = [
  'CHG-BLR-005', 'CHG-BLR-006', 'CHG-DEL-003', 'CHG-DEL-004',
  'CHG-HYD-010', 'CHG-MUM-007', 'CHG-MUM-008', 'CHG-NCR-001',
  'CHG-NCR-002', 'CHG-PUN-009'
];

async function runVerification() {
  console.log('=== VERIFYING REAL CHARGERS & APIS ===');

  // 1. Fetch chargers list
  const chargersRes = await axios.get(`${API_BASE}/chargers?limit=100`);
  const chargers = chargersRes.data.data.chargers;
  console.log(`\n1. Active chargers count: ${chargers.length}`);

  console.log('\nFirst 5 Chargers:');
  chargers.slice(0, 5).forEach((c, idx) => {
    console.log(`  ${idx + 1}. "${c.title}" | City: ${c.location.city} | Price: ₹${c.pricePerHour}/hr | Coordinates: [${c.location.coordinates.join(', ')}] | HostType: ${c.hostType || 'N/A'}`);
  });

  // 2. Check obsolete IDs
  const foundObsolete = [];
  chargers.forEach(c => {
    obsoleteIds.forEach(obs => {
      if (c._id === obs || c.stationCode === obs || c.title?.includes(obs)) {
        foundObsolete.push({ obs, charger: c.title, id: c._id });
      }
    });
  });

  if (foundObsolete.length === 0) {
    console.log('\n2. Obsolete IDs check: PASSED (None of the 10 obsolete IDs appear in the active charger list).');
  } else {
    console.error('\n2. Obsolete IDs check: FAILED! Found:', foundObsolete);
  }

  // 3. Charger details API
  const testCharger = chargers[0];
  const detailRes = await axios.get(`${API_BASE}/chargers/${testCharger._id}`);
  const detailedCharger = detailRes.data.data.charger || detailRes.data.data;
  console.log(`\n3. Charger detail API for "${detailedCharger.title}": OK (Status: ${detailRes.status})`);
  console.log(`   Address: ${detailedCharger.location.address}`);
  console.log(`   Amenities: ${detailedCharger.amenities?.join(', ')}`);
  console.log(`   Owner: ${detailedCharger.owner?.name || detailedCharger.owner?.email || 'N/A'}`);

  // 4. ML Demand Prediction
  try {
    const mlRes = await axios.get(`${API_BASE}/ml/demand/${testCharger._id}?timestamp=2024-10-20T14:00:00.000Z`);
    console.log(`\n4. ML Demand API for "${testCharger.title}" (${testCharger._id}):`);
    console.log(`   Status: ${mlRes.status}`);
    console.log(`   Demand Value: ${mlRes.data.data.demandValue}`);
    console.log(`   Source: ${mlRes.data.data.source || 'ML_XGBOOST'}`);
    console.log(`   Calibration Station: ${mlRes.data.data.calibrationStationId}`);
  } catch (err) {
    console.error('\n4. ML Demand API Failed:', err.response?.data || err.message);
  }

  // 5. Booking verification
  try {
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'arjun.sharma@gmail.com',
      password: 'password123'
    });

    const token = loginRes.data.data.accessToken || loginRes.data.token;
    console.log(`\n5. Driver login successful for: ${loginRes.data.data.user.name}`);

    // Get available slot
    const slotsRes = await axios.get(`${API_BASE}/slots/driver/${testCharger._id}`);
    const availableSlots = slotsRes.data.data.slots || slotsRes.data.data || [];
    console.log(`   Available slots for "${testCharger.title}": ${availableSlots.length} slots found`);

    const bookableSlot = availableSlots.find(s => s.isBookable || s.status === 'available');

    if (bookableSlot) {
      const slotId = bookableSlot.id || bookableSlot._id;
      console.log(`   Testing booking for slot: ${slotId} (${bookableSlot.startTime} to ${bookableSlot.endTime})`);

      const bookingRes = await axios.post(
        `${API_BASE}/bookings`,
        {
          chargerId: testCharger._id,
          slotId: slotId,
          startTime: bookableSlot.startTime,
          endTime: bookableSlot.endTime
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const bookingData = bookingRes.data.data.booking || bookingRes.data.data;
      console.log(`   Booking Created Successfully! Booking ID: ${bookingData._id || bookingData.id}`);
      console.log(`   Charger: ${bookingData.charger?.title || bookingData.charger}`);
      console.log(`   Status: ${bookingData.status}`);
      console.log(`   Total Price: ₹${bookingData.totalPrice}`);
    } else {
      console.log('   No available bookable slot found to test booking.');
    }
  } catch (err) {
    console.error('\n5. Booking Verification Failed:', err.response?.data || err.message);
  }

  console.log('\n=== ALL VERIFICATIONS COMPLETE ===');
}

runVerification().catch(console.error);
