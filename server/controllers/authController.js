import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import { sendPasswordResetEmail } from '../services/email/email.service.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import {
  createRefreshToken,
  rotateRefreshToken,
  revokeToken,
  revokeAllUserTokens,
  getRefreshTokenCookieOptions,
} from '../services/auth/refreshToken.service.js';

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, vehicle } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'An account with this email address already exists',
        },
      });
    }

    // Normalize role: driver -> driver, host / owner / both -> HOST
    let normalizedRole = 'driver'; // Default: everyone starts as driver
    
    if (role) {
      const roleLower = role.toLowerCase();
      if (roleLower === 'host' || roleLower === 'owner' || roleLower === 'both') {
        normalizedRole = 'HOST';
      } else if (roleLower === 'driver' || roleLower === 'renter') {
        normalizedRole = 'driver';
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: 'Invalid role. Driver, Host, or Both are allowed.',
          },
        });
      }
    }

    const newUser = await User.create({
      name,
      email,
      passwordHash: password,
      role: normalizedRole,
      phone: phone || '',
      vehicle: vehicle || {},
      walletBalance: 1500, // EVsathi Promotional Welcome Credit
    });

    // Create promotional credit transaction record
    await Payment.create({
      user: newUser._id,
      amount: 1500,
      type: 'CREDIT',
      description: 'Welcome bonus - EVsathi promotional credit',
      category: 'PROMOTIONAL_CREDIT',
      currency: 'INR',
      paymentMode: 'wallet',
      razorpayOrderId: `promo_${newUser._id}`,
      razorpayPaymentId: `pay_promo_welcome`,
      status: 'VERIFIED',
    });

    // Generate access token
    const accessToken = generateAccessToken({ id: newUser._id, role: newUser.role });
    
    // Create refresh token with device info and store in database
    const deviceInfo = {
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip || req.connection.remoteAddress || '',
      deviceName: 'web',
    };
    const { token: refreshToken } = await createRefreshToken(newUser._id, deviceInfo);
    
    // Set refresh token as HttpOnly cookie
    res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());

    const userObj = newUser.toObject();
    delete userObj.passwordHash;

    res.status(201).json({
      success: true,
      data: {
        user: userObj,
        accessToken,
        // Note: refreshToken is now in HttpOnly cookie, not in response body
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password, role: requestedRole } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password credentials',
        },
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password credentials',
        },
      });
    }

    // Role validation when requestedRole is supplied
    const userStoredRole = (user.role || '').trim().toLowerCase();
    const isUserDriver = ['driver', 'renter'].includes(userStoredRole);
    const isUserHost = ['host', 'owner'].includes(userStoredRole);
    const isUserBoth = ['both'].includes(userStoredRole) || userStoredRole === 'admin';

    let effectiveRole = user.role;

    if (requestedRole) {
      const requested = requestedRole.trim().toLowerCase();
      if (requested === 'driver') {
        if (!isUserDriver && !isUserBoth) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'ROLE_MISMATCH',
              message: 'This account is registered as a Host. Please select Host.',
            },
          });
        }
        if (isUserBoth) effectiveRole = 'driver';
      } else if (requested === 'host' || requested === 'owner') {
        if (!isUserHost && !isUserBoth) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'ROLE_MISMATCH',
              message: 'This account is registered as a Driver. Please select Driver.',
            },
          });
        }
        if (isUserBoth) effectiveRole = 'HOST';
      }
    }

    // Generate access token
    const accessToken = generateAccessToken({ id: user._id, role: effectiveRole });
    
    // Create refresh token with device info and store in database
    const deviceInfo = {
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip || req.connection.remoteAddress || '',
      deviceName: 'web',
    };
    const { token: refreshToken } = await createRefreshToken(user._id, deviceInfo);
    
    // Set refresh token as HttpOnly cookie
    res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());

    const userObj = user.toObject();
    delete userObj.passwordHash;
    userObj.role = effectiveRole;

    res.status(200).json({
      success: true,
      data: {
        user: userObj,
        accessToken,
        // Note: refreshToken is now in HttpOnly cookie, not in response body
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    
    if (refreshToken) {
      // Revoke the refresh token
      await revokeToken(refreshToken, 'LOGOUT');
    }
    
    // Clear the refresh token cookie
    res.clearCookie('refreshToken', getRefreshTokenCookieOptions());
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    // Get refresh token from HttpOnly cookie (preferred) or request body (legacy)
    const oldRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    
    if (!oldRefreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'REFRESH_TOKEN_REQUIRED', message: 'Refresh token required' },
      });
    }

    // Get device info for rotation
    const deviceInfo = {
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip || req.connection.remoteAddress || '',
      deviceName: 'web',
    };

    // Rotate refresh token (validates and creates new one)
    const { newToken, userId } = await rotateRefreshToken(oldRefreshToken, deviceInfo);
    
    // Fetch user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'User no longer exists' },
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({ id: user._id, role: user.role });
    
    // Set new refresh token as HttpOnly cookie
    res.cookie('refreshToken', newToken, getRefreshTokenCookieOptions());

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        // Note: refreshToken is now in HttpOnly cookie, not in response body
      },
    });
  } catch (error) {
    // Handle specific token rotation errors
    if (error.message === 'TOKEN_REUSE_DETECTED') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REUSE_DETECTED',
          message: 'Token reuse detected. All tokens in this session have been revoked for security.',
        },
      });
    }
    
    if (error.message === 'TOKEN_REVOKED' || error.message === 'TOKEN_EXPIRED') {
      return res.status(401).json({
        success: false,
        error: { code: error.message, message: 'Refresh token is no longer valid' },
      });
    }
    
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' },
    });
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, vehicle, notificationPreferences } = req.body;

    if (name) req.user.name = name;
    if (phone !== undefined) req.user.phone = phone;
    if (vehicle) req.user.vehicle = { ...req.user.vehicle, ...vehicle };
    if (notificationPreferences) {
      req.user.notificationPreferences = { ...req.user.notificationPreferences, ...notificationPreferences };
    }

    await req.user.save();

    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+passwordHash');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
      });
    }

    user.passwordHash = newPassword;
    await user.save();
    
    // Revoke all existing refresh tokens for security
    await revokeAllUserTokens(user._id, 'PASSWORD_CHANGED');
    
    // Clear the current refresh token cookie
    res.clearCookie('refreshToken', getRefreshTokenCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Password updated successfully. Please log in again with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password
 * Step 1: Request password reset link.
 * 
 * Cryptographically secure, account-enumeration safe implementation:
 * - Generates high-entropy 32-byte random token
 * - Stores SHA-256 hash of token with 15-minute expiry in DB
 * - Dispatches secure link via email service
 * - Returns identical generic response whether email exists or not
 * - Never leaks raw reset tokens to API responses
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    // Generic response preventing account enumeration
    const genericResponse = {
      success: true,
      message: 'If the email is registered, a password reset link has been sent.',
    };

    if (!email || typeof email !== 'string') {
      return res.status(200).json(genericResponse);
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      // Return same generic response to prevent account enumeration
      return res.status(200).json(genericResponse);
    }

    // 1. Generate 32-byte cryptographically secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');

    // 2. Compute SHA-256 hash to store in DB
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 3. 15-minute expiration
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // 4. Invalidate any existing unused reset tokens for this user
    await PasswordResetToken.updateMany(
      { user: user._id, used: false },
      { used: true, usedAt: new Date() }
    );

    // 5. Store hashed token record
    await PasswordResetToken.create({
      user: user._id,
      tokenHash,
      expiresAt,
      ip: req.ip || req.connection?.remoteAddress || '',
      userAgent: req.headers['user-agent'] || '',
    });

    // 6. Deliver link through configured email mechanism
    await sendPasswordResetEmail({
      toEmail: user.email,
      userName: user.name,
      resetToken: rawToken,
    });

    return res.status(200).json(genericResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password
 * Step 2: Complete password reset with validated server-side token.
 * 
 * Strict security implementation:
 * - Accepts ONLY { token, newPassword }
 * - Never trusts client-provided email, userId, or role
 * - The account being reset is determined SOLELY from the validated token record
 * - Token is single-use and invalidated immediately
 * - Invalidates all active sessions for that user
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'This password reset link is invalid or has expired. Please request a new one.',
        },
      });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters long.',
        },
      });
    }

    // 1. Hash incoming token with SHA-256
    const cleanToken = token.trim();
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    // 2. Find matching reset record in database
    const resetRecord = await PasswordResetToken.findOne({ tokenHash });

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'This password reset link is invalid or has expired. Please request a new one.',
        },
      });
    }

    // 3. Check whether token was already used
    if (resetRecord.used) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_ALREADY_USED',
          message: 'This password reset link is invalid or has expired. Please request a new one.',
        },
      });
    }

    // 4. Check expiration (15 minutes)
    if (resetRecord.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'This password reset link is invalid or has expired. Please request a new one.',
        },
      });
    }

    // 5. Resolve the associated user strictly from server-side record
    const user = await User.findById(resetRecord.user).select('+passwordHash');
    if (!user) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'This password reset link is invalid or has expired. Please request a new one.',
        },
      });
    }

    // 6. Invalidate token immediately (single-use)
    resetRecord.used = true;
    resetRecord.usedAt = new Date();
    await resetRecord.save();

    // 7. Update user's password (triggers bcrypt hash in pre-save hook)
    user.passwordHash = newPassword;
    await user.save();

    // 8. Revoke all active sessions and clear cookies for security
    await revokeAllUserTokens(user._id, 'PASSWORD_RESET');
    res.clearCookie('refreshToken', getRefreshTokenCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Your password has been successfully reset. Please log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

