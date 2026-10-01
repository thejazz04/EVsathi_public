import crypto from 'crypto';
import RefreshToken from '../../models/RefreshToken.js';
import { generateRefreshToken as generateJWT, verifyRefreshToken as verifyJWT } from '../../utils/jwt.js';

/**
 * Generate a unique token family ID for tracking token chains
 */
const generateTokenFamily = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create and store a new refresh token
 * @param {ObjectId} userId - User ID
 * @param {Object} deviceInfo - Device information (userAgent, ip, deviceName)
 * @param {string|null} existingFamily - Existing token family for rotation
 * @returns {Promise<{token: string, tokenDoc: RefreshToken}>}
 */
export const createRefreshToken = async (userId, deviceInfo = {}, existingFamily = null) => {
  // Generate JWT refresh token with unique jti to ensure uniqueness
  const token = generateJWT({ id: userId.toString(), jti: crypto.randomBytes(16).toString('hex') });
  
  // Decode to get expiration
  const decoded = verifyJWT(token);
  const expiresAt = new Date(decoded.exp * 1000);
  
  // Use existing family or create new one
  const family = existingFamily || generateTokenFamily();
  
  // Store in database
  const tokenDoc = await RefreshToken.create({
    token,
    user: userId,
    family,
    deviceInfo: {
      userAgent: deviceInfo.userAgent || '',
      ip: deviceInfo.ip || '',
      deviceName: deviceInfo.deviceName || '',
    },
    expiresAt,
  });
  
  return { token, tokenDoc };
};

/**
 * Verify and rotate refresh token (for automatic token rotation)
 * @param {string} oldToken - Current refresh token
 * @param {Object} deviceInfo - Device information
 * @returns {Promise<{newToken: string, userId: ObjectId, tokenDoc: RefreshToken}>}
 * @throws {Error} If token is invalid, expired, revoked, or reused
 */
export const rotateRefreshToken = async (oldToken, deviceInfo = {}) => {
  // Verify JWT signature first
  let decoded;
  try {
    decoded = verifyJWT(oldToken);
  } catch (err) {
    throw new Error('INVALID_TOKEN_SIGNATURE');
  }
  
  // Find token in database
  const tokenDoc = await RefreshToken.findOne({ token: oldToken }).populate('user');
  
  if (!tokenDoc) {
    throw new Error('TOKEN_NOT_FOUND');
  }
  
  // Check if token was already used (reuse detection)
  if (tokenDoc.replacedBy) {
    // Token reuse detected! Revoke entire family
    await RefreshToken.revokeFamilyByToken(oldToken);
    throw new Error('TOKEN_REUSE_DETECTED');
  }
  
  // Check if token is revoked
  if (tokenDoc.isRevoked) {
    throw new Error('TOKEN_REVOKED');
  }
  
  // Check if token is expired
  if (tokenDoc.expiresAt < new Date()) {
    // Mark as expired and revoke
    await tokenDoc.revoke('EXPIRED');
    throw new Error('TOKEN_EXPIRED');
  }
  
  // Create new token in same family
  const { token: newToken, tokenDoc: newTokenDoc } = await createRefreshToken(
    tokenDoc.user._id,
    deviceInfo,
    tokenDoc.family
  );
  
  // Mark old token as replaced
  tokenDoc.replacedBy = newTokenDoc._id;
  tokenDoc.lastUsedAt = new Date();
  await tokenDoc.save();
  
  return {
    newToken,
    userId: tokenDoc.user._id,
    tokenDoc: newTokenDoc,
  };
};

/**
 * Verify refresh token without rotation (for validation only)
 * @param {string} token - Refresh token
 * @returns {Promise<{valid: boolean, userId: ObjectId|null, reason: string|null}>}
 */
export const verifyRefreshToken = async (token) => {
  try {
    // Verify JWT signature
    const decoded = verifyJWT(token);
    
    // Find token in database
    const tokenDoc = await RefreshToken.findOne({ token });
    
    if (!tokenDoc) {
      return { valid: false, userId: null, reason: 'TOKEN_NOT_FOUND' };
    }
    
    if (!tokenDoc.isValid()) {
      return { valid: false, userId: null, reason: 'TOKEN_INVALID_OR_REVOKED' };
    }
    
    return { valid: true, userId: tokenDoc.user, reason: null };
  } catch (err) {
    return { valid: false, userId: null, reason: 'INVALID_TOKEN_SIGNATURE' };
  }
};

/**
 * Revoke a specific refresh token
 * @param {string} token - Token to revoke
 * @param {string} reason - Revocation reason
 * @returns {Promise<boolean>}
 */
export const revokeToken = async (token, reason = 'MANUAL_REVOCATION') => {
  const tokenDoc = await RefreshToken.findOne({ token });
  if (!tokenDoc) {
    return false;
  }
  
  await tokenDoc.revoke(reason);
  return true;
};

/**
 * Revoke all refresh tokens for a user
 * @param {ObjectId} userId - User ID
 * @param {string} reason - Revocation reason
 * @returns {Promise<number>} - Number of tokens revoked
 */
export const revokeAllUserTokens = async (userId, reason = 'MANUAL_REVOCATION') => {
  return await RefreshToken.revokeAllForUser(userId, reason);
};

/**
 * Get refresh token cookie options
 * @returns {Object} Cookie options for HttpOnly secure cookies
 */
export const getRefreshTokenCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true, // Prevents XSS attacks
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? 'strict' : 'lax', // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
};
