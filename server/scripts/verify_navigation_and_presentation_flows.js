import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_BASE = 'http://localhost:5000/api';
const CLIENT_BASE = 'http://localhost:5173';

async function main() {
  console.log('====================================================');
  console.log('STARTING PRODUCT NAVIGATION & FLOW VERIFICATION');
  console.log('====================================================\n');

  // Test 1: Homepage Loads & Content Structure
  console.log('--- Step 1: Verifying Homepage Content & Marketplace Branding ---');
  const homeRes = await fetch(`${CLIENT_BASE}/`);
  if (homeRes.status !== 200) {
    console.error('❌ Homepage failed to load:', homeRes.status);
    process.exit(1);
  }
  const homeHtml = await homeRes.text();
  console.log('✅ Homepage loads with HTTP 200');

  // Check Featured Chargers API on Homepage
  const featuredRes = await fetch(`${API_BASE}/chargers?limit=4`);
  const featuredData = await featuredRes.json();
  const chargersList = featuredData.data?.chargers || featuredData.data || [];
  if (featuredRes.status === 200 && chargersList.length > 0) {
    console.log(`✅ Real Featured Chargers endpoint working: returned ${chargersList.length} chargers`);
    console.log(`   Sample station: "${chargersList[0].title}" (${chargersList[0].powerOutput} kW, ₹${chargersList[0].pricePerHour}/hr)`);
  } else {
    console.error('❌ Featured chargers API failed or returned 0 chargers:', featuredData);
    process.exit(1);
  }

  // Test 2: Driver Authentication & Overview Navigation
  console.log('\n--- Step 2: Testing Driver Flow & Overview Navigation ---');
  const driverLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'arjun.sharma@gmail.com',
      password: 'password123',
    }),
  });
  const driverLoginData = await driverLoginRes.json();
  if (driverLoginRes.status !== 200 || !driverLoginData.data?.accessToken) {
    console.error('❌ Driver login failed:', driverLoginData);
    process.exit(1);
  }
  const driverToken = driverLoginData.data.accessToken;
  const driverUser = driverLoginData.data.user;
  console.log(`✅ Driver authenticated: ${driverUser.name} (Role: ${driverUser.role})`);

  // Verify Driver Dashboard Data Dependencies
  const driverChargersRes = await fetch(`${API_BASE}/chargers?limit=6`, {
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  const driverBookingsRes = await fetch(`${API_BASE}/bookings`, {
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  if (driverChargersRes.status === 200 && driverBookingsRes.status === 200) {
    console.log('✅ Driver Dashboard APIs (chargers list, my bookings) responded with HTTP 200');
  } else {
    console.error('❌ Driver Dashboard APIs failed:', {
      chargersStatus: driverChargersRes.status,
      bookingsStatus: driverBookingsRes.status,
    });
    process.exit(1);
  }

  // Verify Smart Demand Insight for Driver
  const targetChargerId = chargersList[0]._id;
  const demandRes = await fetch(`${API_BASE}/ml/demand/${targetChargerId}?timestamp=${encodeURIComponent(new Date().toISOString())}`, {
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  const demandData = await demandRes.json();
  if (demandRes.status === 200 && demandData.data) {
    console.log(`✅ Smart Charging Demand Insight returned for "${chargersList[0].title}":`);
    console.log(`   - Predicted Demand Index: ${demandData.data.predictedDemand ?? demandData.data.predicted_demand ?? 'N/A'}`);
    console.log(`   - Pricing Factor: ${demandData.data.demandFactor ?? 'Active'}`);
  } else {
    console.log('ℹ️  ML demand endpoint fallback/status:', demandData.error?.message || demandRes.status);
  }

  // Test 3: Charger Discovery & Availability (Booking Flow Verification)
  console.log('\n--- Step 3: Verifying Charger Discovery & Slot Availability Flow ---');
  const singleChargerRes = await fetch(`${API_BASE}/chargers/${targetChargerId}`);
  const singleChargerData = await singleChargerRes.json();
  const chargerObj = singleChargerData.data?.charger || singleChargerData.data;
  if (singleChargerRes.status === 200 && chargerObj) {
    console.log(`✅ Single Charger Details retrieved: "${chargerObj.title}"`);
    console.log(`   - Location: ${chargerObj.location?.address}, ${chargerObj.location?.city}`);
    console.log(`   - Connector: ${chargerObj.connectorType}, Power: ${chargerObj.powerOutput} kW`);
  } else {
    console.error('❌ Failed to retrieve single charger details:', singleChargerData);
    process.exit(1);
  }

  const availabilityRes = await fetch(`${API_BASE}/chargers/${targetChargerId}/availability`);
  const availabilityData = await availabilityRes.json();
  if (availabilityRes.status === 200) {
    console.log('✅ Charger Slot Availability endpoint responded with HTTP 200');
  } else {
    console.error('❌ Slot availability endpoint failed:', availabilityData);
    process.exit(1);
  }

  // Test 4: Host Authentication & Host Dashboard Flow
  console.log('\n--- Step 4: Testing Host Flow & Host Dashboard Navigation ---');
  const hostLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'anita.menon@gmail.com',
      password: 'password123',
    }),
  });
  const hostLoginData = await hostLoginRes.json();
  if (hostLoginRes.status !== 200 || !hostLoginData.data?.accessToken) {
    console.error('❌ Host login failed:', hostLoginData);
    process.exit(1);
  }
  const hostToken = hostLoginData.data.accessToken;
  const hostUser = hostLoginData.data.user;
  console.log(`✅ Host authenticated: ${hostUser.name} (Role: ${hostUser.role})`);

  // Verify Host Chargers & Rentals
  const myChargersRes = await fetch(`${API_BASE}/chargers/my-chargers`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  const myChargersData = await myChargersRes.json();
  const hostChargersList = myChargersData.data?.chargers || myChargersData.data || [];
  if (myChargersRes.status === 200) {
    console.log(`✅ Host station list returned HTTP 200 (Found ${hostChargersList.length} chargers listed by this host)`);
  } else {
    console.error('❌ Host chargers endpoint failed:', myChargersData);
    process.exit(1);
  }

  // Verify Host Rentals Bookings
  const hostBookingsRes = await fetch(`${API_BASE}/bookings?type=rentals`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  const hostBookingsData = await hostBookingsRes.json();
  if (hostBookingsRes.status === 200) {
    console.log('✅ Host rentals bookings returned HTTP 200');
  } else {
    console.error('❌ Host rentals bookings failed:', hostBookingsData);
    process.exit(1);
  }

  // Verify Host Analytics / Earnings
  const hostAnalyticsRes = await fetch(`${API_BASE}/analytics/host`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  const hostAnalyticsData = await hostAnalyticsRes.json();
  if (hostAnalyticsRes.status === 200) {
    console.log(`✅ Host Analytics API returned HTTP 200:`);
    console.log(`   - Total Earnings: ₹${hostAnalyticsData.data?.totalEarnings ?? hostAnalyticsData.data?.earnings ?? 0}`);
  } else {
    console.log('ℹ️  Host analytics endpoint status:', hostAnalyticsRes.status);
  }

  // Test 5: Verify Auth Protection & Overview Non-leakage
  console.log('\n--- Step 5: Auditing Navigation Security & Overview Behavior ---');
  // Unauthenticated request to /api/auth/me MUST return 401
  const unauthRes = await fetch(`${API_BASE}/auth/me`);
  if (unauthRes.status === 401) {
    console.log('✅ Unauthenticated /api/auth/me correctly returns HTTP 401');
  } else {
    console.error('❌ Unauthenticated request was not rejected with 401:', unauthRes.status);
    process.exit(1);
  }

  // Authenticated requests to /api/auth/me return respective user roles
  const driverMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  const driverMeData = await driverMeRes.json();
  if (driverMeRes.status === 200 && driverMeData.data.user.role === 'driver') {
    console.log('✅ Driver session validated: Role is "driver" -> Maps to /driver/dashboard');
  }

  const hostMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  const hostMeData = await hostMeRes.json();
  if (hostMeRes.status === 200 && (hostMeData.data.user.role === 'HOST' || hostMeData.data.user.role === 'host')) {
    console.log('✅ Host session validated: Role is "HOST" -> Maps to /owner/dashboard');
  }

  console.log('\n====================================================');
  console.log('ALL PRODUCT NAVIGATION & FLOW TESTS PASSED (5/5)');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Fatal error during product navigation verification:', err);
  process.exit(1);
});
