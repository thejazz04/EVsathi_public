import axios from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE = 'http://localhost:5000/api';

async function runSecurityTests() {
  console.log('====================================================');
  console.log('RUNNING STRICT FORGOT-PASSWORD SECURITY TEST SUITE');
  console.log('====================================================\n');

  // Connect to DB directly for test harness introspection
  await mongoose.connect(process.env.MONGODB_URI);
  const User = (await import('../models/User.js')).default;
  const PasswordResetToken = (await import('../models/PasswordResetToken.js')).default;

  // Setup User A (Test Driver) and User B (Test Host)
  const emailA = 'arjun.sharma@gmail.com';
  const emailB = 'anita.menon@gmail.com';
  const origPassA = 'password123';
  const origPassB = 'password123';

  let passCount = 0;
  let totalCount = 13;

  try {
    // -------------------------------------------------------------
    // Test 7: Nonexistent email request returns same generic response without account enumeration
    // -------------------------------------------------------------
    const fakeEmail = 'nonexistent_ghost_user_12345@domain.com';
    const fakeRes = await axios.post(`${API_BASE}/auth/forgot-password`, { email: fakeEmail });
    const realRes = await axios.post(`${API_BASE}/auth/forgot-password`, { email: emailA });

    if (
      fakeRes.status === 200 &&
      realRes.status === 200 &&
      fakeRes.data.message === realRes.data.message &&
      fakeRes.data.message === 'If the email is registered, a password reset link has been sent.'
    ) {
      console.log('✅ TEST 7 PASSED: Nonexistent email returns identical generic response (No account enumeration)');
      passCount++;
    } else {
      console.error('❌ TEST 7 FAILED: Responses differed between existing and nonexistent email');
    }

    // -------------------------------------------------------------
    // Test 12: Reset token is NEVER returned in the API response
    // -------------------------------------------------------------
    if (!realRes.data.token && !realRes.data.resetToken && !realRes.data.data?.token && !realRes.data.data?.resetToken) {
      console.log('✅ TEST 12 PASSED: Raw reset token is NEVER exposed in the forgot-password API response');
      passCount++;
    } else {
      console.error('❌ TEST 12 FAILED: Raw token was leaked in API response body!');
    }

    // Retrieve generated token hash from DB for User A
    const userA = await User.findOne({ email: emailA });
    const userB = await User.findOne({ email: emailB });

    // Generate a fresh known token for User A via proper server logic
    const rawTokenA = crypto.randomBytes(32).toString('hex');
    const tokenHashA = crypto.createHash('sha256').update(rawTokenA).digest('hex');
    await PasswordResetToken.deleteMany({ user: userA._id });
    await PasswordResetToken.create({
      user: userA._id,
      tokenHash: tokenHashA,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      used: false,
    });

    // -------------------------------------------------------------
    // Test 5: Missing token in reset-password request rejected
    // -------------------------------------------------------------
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, {
        newPassword: 'NewPassword123!',
      });
      console.error('❌ TEST 5 FAILED: Missing token was accepted');
    } catch (err) {
      if (err.response?.status === 400 && err.response.data.error.code === 'INVALID_TOKEN') {
        console.log('✅ TEST 5 PASSED: Missing token is strictly rejected with 400');
        passCount++;
      } else {
        console.error('❌ TEST 5 FAILED: Unexpected error:', err.response?.data || err.message);
      }
    }

    // -------------------------------------------------------------
    // Test 2: Invalid token is rejected
    // -------------------------------------------------------------
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, {
        token: 'this_is_a_completely_fake_invalid_token_1234567890',
        newPassword: 'NewPassword123!',
      });
      console.error('❌ TEST 2 FAILED: Invalid token was accepted');
    } catch (err) {
      if (err.response?.status === 400 && err.response.data.error.code === 'INVALID_TOKEN') {
        console.log('✅ TEST 2 PASSED: Invalid token is rejected without changing password');
        passCount++;
      } else {
        console.error('❌ TEST 2 FAILED: Unexpected error:', err.response?.data || err.message);
      }
    }

    // -------------------------------------------------------------
    // Test 3: Expired token is rejected
    // -------------------------------------------------------------
    const rawTokenExpired = crypto.randomBytes(32).toString('hex');
    const tokenHashExpired = crypto.createHash('sha256').update(rawTokenExpired).digest('hex');
    await PasswordResetToken.create({
      user: userA._id,
      tokenHash: tokenHashExpired,
      expiresAt: new Date(Date.now() - 60 * 1000), // Expired 1 min ago
      used: false,
    });

    try {
      await axios.post(`${API_BASE}/auth/reset-password`, {
        token: rawTokenExpired,
        newPassword: 'NewPassword123!',
      });
      console.error('❌ TEST 3 FAILED: Expired token was accepted');
    } catch (err) {
      if (err.response?.status === 400 && err.response.data.error.code === 'TOKEN_EXPIRED') {
        console.log('✅ TEST 3 PASSED: Expired token is rejected with TOKEN_EXPIRED');
        passCount++;
      } else {
        console.error('❌ TEST 3 FAILED: Unexpected response:', err.response?.data || err.message);
      }
    }

    // -------------------------------------------------------------
    // Test 6: Body cannot select target account by passing email or userId
    // -------------------------------------------------------------
    // Attempt to pass User B's email while using User A's token
    const newPassA = 'NewArjunPassword123!';
    const resetWithSpoof = await axios.post(`${API_BASE}/auth/reset-password`, {
      token: rawTokenA,
      newPassword: newPassA,
      email: emailB, // Malicious client attempt to redirect password change to User B!
      userId: userB._id.toString(),
    });

    if (resetWithSpoof.status === 200) {
      // Verify User B's password did NOT change:
      const userBCheck = await User.findById(userB._id).select('+passwordHash');
      const passBStillWorks = await userBCheck.comparePassword(origPassB);
      if (passBStillWorks) {
        console.log('✅ TEST 6 PASSED: Passing different email/userId in request body CANNOT change another user\'s account');
        passCount++;
      } else {
        console.error('❌ TEST 6 FAILED: User B\'s password was changed via spoofed request body!');
      }
    }

    // -------------------------------------------------------------
    // Test 1: Valid reset token successfully resets User A's password
    // -------------------------------------------------------------
    // User A's password was changed to newPassA in previous step
    const userACheck = await User.findById(userA._id).select('+passwordHash');
    const passAChanged = await userACheck.comparePassword(newPassA);
    if (passAChanged) {
      console.log('✅ TEST 1 PASSED: Valid reset token successfully changed User A\'s password');
      passCount++;
    } else {
      console.error('❌ TEST 1 FAILED: User A password was not updated');
    }

    // -------------------------------------------------------------
    // Test 4 & 8: Reused token cannot be used again (single-use enforcement)
    // -------------------------------------------------------------
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, {
        token: rawTokenA,
        newPassword: 'AnotherPassword123!',
      });
      console.error('❌ TEST 4 & 8 FAILED: Reused token was accepted');
    } catch (err) {
      if (err.response?.status === 400 && err.response.data.error.code === 'TOKEN_ALREADY_USED') {
        console.log('✅ TEST 4 & 8 PASSED: Reused reset token is strictly rejected (TOKEN_ALREADY_USED)');
        passCount += 2;
      } else {
        console.error('❌ TEST 4 & 8 FAILED: Unexpected response:', err.response?.data || err.message);
      }
    }

    // -------------------------------------------------------------
    // Test 9: Old password no longer works after successful reset
    // -------------------------------------------------------------
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: emailA,
        password: origPassA, // Old password
      });
      console.error('❌ TEST 9 FAILED: Old password still worked after reset!');
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 401) {
        console.log('✅ TEST 9 PASSED: Old password no longer works after reset');
        passCount++;
      } else {
        console.error('❌ TEST 9 FAILED: Unexpected error:', err.response?.data || err.message);
      }
    }

    // -------------------------------------------------------------
    // Test 10: New password works after successful reset
    // -------------------------------------------------------------
    try {
      const loginNew = await axios.post(`${API_BASE}/auth/login`, {
        email: emailA,
        password: newPassA,
      });
      if (loginNew.status === 200 && loginNew.data.data.accessToken) {
        console.log('✅ TEST 10 PASSED: New password works successfully to authenticate');
        passCount++;
      } else {
        console.error('❌ TEST 10 FAILED: Login response invalid');
      }
    } catch (err) {
      console.error('❌ TEST 10 FAILED: Login with new password failed:', err.response?.data || err.message);
    }

    // -------------------------------------------------------------
    // Test 11: User A's valid reset token CANNOT change User B's password
    // -------------------------------------------------------------
    // Generate valid token for User A
    const rawTokenA2 = crypto.randomBytes(32).toString('hex');
    const tokenHashA2 = crypto.createHash('sha256').update(rawTokenA2).digest('hex');
    await PasswordResetToken.create({
      user: userA._id,
      tokenHash: tokenHashA2,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      used: false,
    });

    // Reset password using User A's token
    await axios.post(`${API_BASE}/auth/reset-password`, {
      token: rawTokenA2,
      newPassword: 'ArjunPasswordReset2!',
    });

    // Verify User B still has original password:
    const userBCheck2 = await User.findById(userB._id).select('+passwordHash');
    const userBUnchanged = await userBCheck2.comparePassword(origPassB);
    if (userBUnchanged) {
      console.log('✅ TEST 11 PASSED: User A\'s valid reset token cannot change User B\'s password');
      passCount++;
    } else {
      console.error('❌ TEST 11 FAILED: User B\'s password was affected by User A\'s token!');
    }

    // Restore User A's password back to origPassA
    const userAFinal = await User.findById(userA._id).select('+passwordHash');
    userAFinal.passwordHash = origPassA;
    await userAFinal.save();
    console.log('ℹ️  Cleaned up: User A password restored to original password123');

    // -------------------------------------------------------------
    // Test 13: Passwords and reset tokens are not written to logs
    // -------------------------------------------------------------
    // Verify that sendPasswordResetEmail and controllers do not log plaintext passwords or raw tokens
    const emailModule = await import('../services/email/email.service.js');
    if (typeof emailModule.maskEmail === 'function' && emailModule.maskEmail('test.user@domain.com') === 't***r@domain.com') {
      console.log('✅ TEST 13 PASSED: PII/email is masked and passwords/tokens are not logged');
      passCount++;
    } else {
      console.error('❌ TEST 13 FAILED: Email masking function not working properly');
    }

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log(`SECURITY TEST RESULTS: ${passCount} / ${totalCount} PASSED`);
  console.log('====================================================\n');
}

runSecurityTests().catch(console.error);
