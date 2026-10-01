import Razorpay from 'razorpay';
import logger from '../utils/logger.js';

let razorpayInstance = null;

const paymentMode = process.env.PAYMENT_MODE || 'mock';

// Production Security Guard: Reject mock payment mode in production
if (process.env.NODE_ENV === 'production' && paymentMode === 'mock') {
  logger.error('CRITICAL SECURITY ERROR: PAYMENT_MODE=mock is strictly forbidden in production!');
  throw new Error('Production environment cannot use mock payment mode. Set PAYMENT_MODE=razorpay and configure valid Razorpay credentials.');
}

if (paymentMode === 'razorpay' && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  logger.info('Razorpay SDK Initialized in Live/Test Mode');
} else {
  logger.warn(`Payment Service running in PAYMENT_MODE=${paymentMode}`);
}

export const getRazorpayInstance = () => razorpayInstance;
export const isMockPayment = () => paymentMode === 'mock';
