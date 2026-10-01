import jwt from 'jsonwebtoken';

// Validate JWT secrets on module load
const validateSecrets = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ALLOW_UNSAFE_SECRETS === 'true';
  const isTest = process.env.NODE_ENV === 'test';
  
  // Allow test mode to skip validation
  if (isTest) {
    return;
  }
  
  // During module load, env vars might not be loaded yet
  // Only validate if we're explicitly in production or have JWT_SECRET set
  const shouldValidate = isProduction || process.env.JWT_SECRET;
  
  if (!shouldValidate && !isDevelopment) {
    // Environment not yet loaded, defer validation
    return;
  }
  
  if (!process.env.JWT_SECRET) {
    if (isProduction) {
      throw new Error('FATAL: JWT_SECRET environment variable is required in production');
    }
    if (!isDevelopment) {
      throw new Error('FATAL: JWT_SECRET environment variable is required. Set ALLOW_UNSAFE_SECRETS=true for development only.');
    }
    console.warn('[SECURITY WARNING] Using default JWT_SECRET - UNSAFE FOR PRODUCTION');
  } else if (process.env.JWT_SECRET.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters long for security');
  }
  
  if (!process.env.JWT_REFRESH_SECRET) {
    if (isProduction) {
      throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is required in production');
    }
    if (!isDevelopment) {
      throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is required. Set ALLOW_UNSAFE_SECRETS=true for development only.');
    }
    console.warn('[SECURITY WARNING] Using default JWT_REFRESH_SECRET - UNSAFE FOR PRODUCTION');
  } else if (process.env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error('FATAL: JWT_REFRESH_SECRET must be at least 32 characters long for security');
  }
};

// Validate on module load (will defer if env not loaded)
validateSecrets();

// Export for explicit validation after .env loads
export const validateJWTSecrets = validateSecrets;

// Use fallback only in explicitly unsafe development mode
const JWT_SECRET = process.env.JWT_SECRET || 'evsathi_default_jwt_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // Reduced from 7d to 15min for security
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'evsathi_default_refresh_secret';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'; // Reduced from 30d to 7d

export const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};
