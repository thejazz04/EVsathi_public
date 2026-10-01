import express from 'express';
import { getWalletTransactions, topupWallet } from '../controllers/walletController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/transactions', getWalletTransactions);
router.post('/topup', topupWallet);

export default router;
