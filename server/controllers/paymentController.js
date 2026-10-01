import {
  processWalletPayment,
  simulateUpiDeposit,
  getWalletBalance,
  getPaymentHistory,
} from '../services/payment/walletPayment.service.js';
import Booking from '../models/Booking.js';

/**
 * Process payment for a booking using wallet
 */
export const payWithWallet = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId).populate('host');
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      });
    }

    // Verify this is the driver's booking
    if (String(booking.driver) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to pay for this booking' },
      });
    }

    // Check if already paid
    if (booking.paymentStatus === 'PAID') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_PAID', message: 'This booking is already paid' },
      });
    }

    const result = await processWalletPayment({
      bookingId: booking._id,
      driverId: req.user._id,
      hostId: booking.host,
      amount: booking.totalPrice,
    });

    res.status(200).json({
      success: true,
      data: {
        payment: result.payment,
        walletBalance: result.driverNewBalance,
        message: 'Payment successful! Booking confirmed.',
      },
    });
  } catch (error) {
    if (error.message.includes('Insufficient wallet balance')) {
      return res.status(400).json({
        success: false,
        error: { code: 'INSUFFICIENT_BALANCE', message: error.message },
      });
    }
    next(error);
  }
};

/**
 * Deposit money to wallet (Simulated UPI)
 */
export const depositToWallet = async (req, res, next) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than 0' },
      });
    }

    const result = await simulateUpiDeposit({
      userId: req.user._id,
      amount: Number(amount),
    });

    res.status(200).json({
      success: true,
      data: result,
      message: `₹${amount} deposited successfully via simulated UPI`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current wallet balance
 */
export const getBalance = async (req, res, next) => {
  try {
    const result = await getWalletBalance(req.user._id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment transaction history
 */
export const getTransactions = async (req, res, next) => {
  try {
    const payments = await getPaymentHistory(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        payments: payments, // Return full payment objects with all fields
      },
    });
  } catch (error) {
    next(error);
  }
};
