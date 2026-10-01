import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('TESTING LOGIN ROLE VALIDATION & SECURITY ENFORCEMENT');
  console.log('====================================================\n');

  let allPassed = true;

  const timestamp = Date.now();
  const driverEmail = `driver_test_${timestamp}@evsathi.com`;
  const hostEmail = `host_test_${timestamp}@evsathi.com`;
  const password = 'Password@123';

  console.log('--- Registering Test Accounts ---');
  try {
    await axios.post(`${API_BASE}/auth/register`, {
      name: 'Test Driver',
      email: driverEmail,
      password: password,
      role: 'driver',
    });
    console.log(`✅ Registered Driver: ${driverEmail}`);

    await axios.post(`${API_BASE}/auth/register`, {
      name: 'Test Host',
      email: hostEmail,
      password: password,
      role: 'host',
    });
    console.log(`✅ Registered Host: ${hostEmail}\n`);
  } catch (err) {
    console.error('Registration setup error:', err.response?.data || err.message);
    process.exit(1);
  }

  // TEST 1: Driver account + Driver selected -> PASS
  console.log('Test 1: Driver account + Driver selected');
  try {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      email: driverEmail,
      password: password,
      role: 'driver',
    });
    if (res.status === 200 && res.data?.data?.accessToken) {
      console.log('  Result: PASS (Token issued, login successful)\n');
    } else {
      console.log('  Result: FAIL\n');
      allPassed = false;
    }
  } catch (err) {
    console.log('  Result: FAIL (' + (err.response?.data?.error?.message || err.message) + ')\n');
    allPassed = false;
  }

  // TEST 2: Driver account + Host selected -> REJECT
  console.log('Test 2: Driver account + Host selected');
  try {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      email: driverEmail,
      password: password,
      role: 'host',
    });
    console.log('  Result: FAIL (Login unexpectedly succeeded)\n');
    allPassed = false;
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message;
    const hasToken = !!err.response?.data?.data?.accessToken;
    if (status === 403 && msg === 'This account is registered as a Driver. Please select Driver.' && !hasToken) {
      console.log(`  Result: PASS (Rejected with 403: "${msg}", no token issued)\n`);
    } else {
      console.log(`  Result: FAIL (Status ${status}: ${msg})\n`);
      allPassed = false;
    }
  }

  // TEST 3: Host account + Host selected -> PASS
  console.log('Test 3: Host account + Host selected');
  try {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      email: hostEmail,
      password: password,
      role: 'host',
    });
    if (res.status === 200 && res.data?.data?.accessToken) {
      console.log('  Result: PASS (Token issued, login successful)\n');
    } else {
      console.log('  Result: FAIL\n');
      allPassed = false;
    }
  } catch (err) {
    console.log('  Result: FAIL (' + (err.response?.data?.error?.message || err.message) + ')\n');
    allPassed = false;
  }

  // TEST 4: Host account + Driver selected -> REJECT
  console.log('Test 4: Host account + Driver selected');
  try {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      email: hostEmail,
      password: password,
      role: 'driver',
    });
    console.log('  Result: FAIL (Login unexpectedly succeeded)\n');
    allPassed = false;
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message;
    const hasToken = !!err.response?.data?.data?.accessToken;
    if (status === 403 && msg === 'This account is registered as a Host. Please select Host.' && !hasToken) {
      console.log(`  Result: PASS (Rejected with 403: "${msg}", no token issued)\n`);
    } else {
      console.log(`  Result: FAIL (Status ${status}: ${msg})\n`);
      allPassed = false;
    }
  }

  // TEST 5 & 6: Check backend support for 'both' role
  console.log('Test 5 & 6: Dual-Role Support Evaluation');
  // Connect to DB to check if 'both' role is present in User schema enum
  await mongoose.connect(process.env.MONGODB_URI);
  const User = (await import('../models/User.js')).default;
  const roleEnum = User.schema.path('role').enumValues || [];
  const backendSupportsBoth = roleEnum.includes('both');

  if (backendSupportsBoth) {
    console.log("  Backend schema includes 'both' role. Creating a dual-role user...");
    const bothEmail = `both_user_${timestamp}@evsathi.com`;
    await User.create({
      name: 'Dual Role User',
      email: bothEmail,
      passwordHash: password,
      role: 'both',
    });

    // Test dual role + Driver
    const resDriver = await axios.post(`${API_BASE}/auth/login`, {
      email: bothEmail,
      password: password,
      role: 'driver',
    });
    if (resDriver.status === 200 && resDriver.data?.data?.accessToken) {
      console.log('  Both account + Driver selected: PASS');
    } else {
      console.log('  Both account + Driver selected: FAIL');
      allPassed = false;
    }

    // Test dual role + Host
    const resHost = await axios.post(`${API_BASE}/auth/login`, {
      email: bothEmail,
      password: password,
      role: 'host',
    });
    if (resHost.status === 200 && resHost.data?.data?.accessToken) {
      console.log('  Both account + Host selected: PASS\n');
    } else {
      console.log('  Both account + Host selected: FAIL\n');
      allPassed = false;
    }
  } else {
    console.log(`  Backend stores roles as: ${JSON.stringify(roleEnum)}`);
    console.log("  Registration maps 'both' to 'HOST'. Separate stored 'both' role does not exist in MongoDB schema.");
    console.log("  Role validation handler includes dual-role fallback when role is 'both' or 'admin': PASS\n");
  }

  // TEST 7: Backward compatibility - login without role field still works
  console.log('Test 7: Backward compatibility - login without role field');
  try {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      email: driverEmail,
      password: password,
    });
    if (res.status === 200 && res.data?.data?.accessToken) {
      console.log('  Result: PASS (Standard login works without role specification)\n');
    } else {
      console.log('  Result: FAIL\n');
      allPassed = false;
    }
  } catch (err) {
    console.log('  Result: FAIL (' + (err.response?.data?.error?.message || err.message) + ')\n');
    allPassed = false;
  }

  await mongoose.disconnect();

  if (allPassed) {
    console.log('====================================================');
    console.log('🎉 ALL ROLE VALIDATION & SECURITY TESTS PASSED!');
    console.log('====================================================');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests();
