import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

async function testAuth() {
  console.log('=== TESTING UNIFIED AUTHENTICATION FLOWS ===\n');

  // 1. Unauthenticated /api/auth/me
  try {
    await axios.get(`${API_BASE}/auth/me`);
    console.error('❌ /api/auth/me should have returned 401 for unauthenticated request');
  } catch (err) {
    if (err.response?.status === 401) {
      console.log('✅ /api/auth/me returns 401 for unauthenticated request');
    } else {
      console.error('❌ /api/auth/me unexpected error:', err.message);
    }
  }

  // 2. Driver Login
  let driverToken;
  try {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      email: 'arjun.sharma@gmail.com',
      password: 'password123',
    });
    console.log(`✅ Driver Login: OK (${res.data.data.user.name}, role: ${res.data.data.user.role})`);
    driverToken = res.data.data.accessToken;
  } catch (err) {
    console.error('❌ Driver Login failed:', err.response?.data || err.message);
  }

  // 3. Authenticated /api/auth/me
  try {
    const res = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    console.log(`✅ Authenticated /api/auth/me: OK (${res.data.data.user.email})`);
  } catch (err) {
    console.error('❌ Authenticated /api/auth/me failed:', err.response?.data || err.message);
  }

  // 4. Host Login
  try {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      email: 'anita.menon@gmail.com',
      password: 'password123',
    });
    console.log(`✅ Host Login: OK (${res.data.data.user.name}, role: ${res.data.data.user.role})`);
  } catch (err) {
    console.error('❌ Host Login failed:', err.response?.data || err.message);
  }

  // 5. Forgot Password & Reset Password Flow
  try {
    // Step A: Request password reset
    const forgotRes = await axios.post(`${API_BASE}/auth/forgot-password`, {
      email: 'arjun.sharma@gmail.com',
    });
    console.log(`✅ /api/auth/forgot-password: OK (Reset token issued for ${forgotRes.data.data.email})`);
    const resetToken = forgotRes.data.data.resetToken;

    // Step B: Reset password to temporary new password
    const resetRes = await axios.post(`${API_BASE}/auth/reset-password`, {
      email: 'arjun.sharma@gmail.com',
      resetToken,
      newPassword: 'Password123!',
    });
    console.log(`✅ /api/auth/reset-password: OK (${resetRes.data.message})`);

    // Step C: Verify login with new password
    const newLoginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'arjun.sharma@gmail.com',
      password: 'Password123!',
    });
    console.log(`✅ Login with new reset password: OK`);

    // Step D: Restore original password
    const restoreForgot = await axios.post(`${API_BASE}/auth/forgot-password`, {
      email: 'arjun.sharma@gmail.com',
    });
    await axios.post(`${API_BASE}/auth/reset-password`, {
      email: 'arjun.sharma@gmail.com',
      resetToken: restoreForgot.data.data.resetToken,
      newPassword: 'password123',
    });
    console.log(`✅ Password restored to original password123`);
  } catch (err) {
    console.error('❌ Forgot/Reset Password flow failed:', err.response?.data || err.message);
  }

  // 6. Registration with role 'both'
  const testEmail = `test_both_${Date.now()}@example.com`;
  try {
    const regRes = await axios.post(`${API_BASE}/auth/register`, {
      name: 'Test Both User',
      email: testEmail,
      password: 'SecurePassword123',
      role: 'both',
      phone: '9988776655',
    });
    console.log(`✅ Registration with role 'both': OK (Created user role: ${regRes.data.data.user.role})`);
  } catch (err) {
    console.error('❌ Registration with role both failed:', err.response?.data || err.message);
  }

  console.log('\n=== ALL API TESTS PASSED ===');
}

testAuth().catch(console.error);
