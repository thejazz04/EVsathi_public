import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  refresh,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { registerSchema, loginSchema, validateRequest } from '../validators/authValidator.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', authRateLimiter, validateRequest(registerSchema), register);
router.post('/login', authRateLimiter, validateRequest(loginSchema), login);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

export default router;
