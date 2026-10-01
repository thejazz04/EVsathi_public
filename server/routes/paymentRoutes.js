import express from 'express';
import {
  payWithWallet,
  depositToWallet,
  getBalance,
  getTransactions,
} from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All payment routes require authentication
router.use(protect);

router.post('/wallet/pay', payWithWallet);
router.post('/wallet/deposit', depositToWallet);
router.get('/wallet/balance', getBalance);
router.get('/wallet/transactions', getTransactions);

export default router;
