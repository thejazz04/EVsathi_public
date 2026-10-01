import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

export const protect = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token missing or invalid',
      },
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account belonging to this token no longer exists',
        },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.warn('JWT Verification error', { message: error.message });
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Session expired or token invalid. Please log in again.',
      },
    });
  }
};
