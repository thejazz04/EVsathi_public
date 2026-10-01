import User from '../../models/User.js';
import Payment from '../../models/Payment.js';
import Booking from '../../models/Booking.js';
import mongoose from 'mongoose';

/**
 * Simulated Wallet Payment Service
 * Handles mock UPI-style payments with wallet deduction and host credit
 */

export const processWalletPayment = async ({ bookingId, driverId, hostId, amount }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 0. Check if booking is already paid (idempotency)
    const existingBooking = await Booking.findById(bookingId).session(session);
    if (!existingBooking) {
      throw new Error('Booking not found');
    }
    
    if (existingBooking.paymentStatus === 'PAID' || existingBooking.status === 'CONFIRMED') {
      // Already paid - return existing payment info (idempotent)
      await session.abortTransaction();
      
      const existingPayment = await Payment.findOne({ 
        booking: bookingId, 
        user: driverId,
        type: 'DEBIT' 
      });
      
      const driver = await User.findById(driverId);
      const host = await User.findById(hostId);
      
      return {
        success: true,
        payment: existingPayment,
        driverNewBalance: driver.walletBalance,
        hostNewBalance: host.walletBalance,
        platformFee: amount * 0.1,
        hostAmount: amount * 0.9,
        alreadyPaid: true,
      };
    }

    // 1. Fetch driver and host
    const driver = await User.findById(driverId).session(session);
    const host = await User.findById(hostId).session(session);

    if (!driver || !host) {
      throw new Error('Driver or host not found');
    }

    // 2. Check if driver has sufficient balance
    if (driver.walletBalance < amount) {
      throw new Error(
        `Insufficient wallet balance. Required: ₹${amount}, Available: ₹${driver.walletBalance}`
      );
    }

    // 3. Deduct from driver wallet
    driver.walletBalance -= amount;
    await driver.save({ session });

    // 4. Credit to host wallet (minus 10% platform fee)
    const platformFee = amount * 0.1; // 10% commission
    const hostAmount = amount - platformFee;
    
    host.walletBalance += hostAmount;
    await host.save({ session });

    // 5. Update booking status to CONFIRMED
    await Booking.findByIdAndUpdate(
      bookingId,
      {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        expiresAt: null, // Remove expiry since payment is done
      },
      { session }
    );

    // 6. Create driver payment record (DEBIT - money out)
    const driverPayment = await Payment.create(
      [
        {
          booking: bookingId,
          user: driverId,
          amount,
          type: 'DEBIT',
          description: 'Charging session payment',
          category: 'BOOKING_PAYMENT',
          currency: 'INR',
          paymentMode: 'wallet',
          status: 'VERIFIED',
          razorpayPaymentId: `wallet_${Date.now()}_${driverId.toString().slice(-6)}`,
        },
      ],
      { session }
    );
    
    // 7. Create host payment record (CREDIT - money in)
    const hostPayment = await Payment.create(
      [
        {
          booking: bookingId,
          user: hostId,
          amount: hostAmount,
          type: 'CREDIT',
          description: `Earnings from charging session (₹${platformFee.toFixed(2)} platform fee deducted)`,
          category: 'HOST_EARNING',
          currency: 'INR',
          paymentMode: 'wallet',
          status: 'VERIFIED',
          razorpayPaymentId: `host_earning_${Date.now()}_${hostId.toString().slice(-6)}`,
        },
      ],
      { session }
    );

    // 8. Commit transaction
    await session.commitTransaction();

    return {
      success: true,
      payment: driverPayment[0],
      hostPayment: hostPayment[0],
      driverNewBalance: driver.walletBalance,
      hostNewBalance: host.walletBalance,
      platformFee,
      hostAmount,
      alreadyPaid: false,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Simulate UPI deposit to wallet (for testing)
 */
export const simulateUpiDeposit = async ({ userId, amount }) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.walletBalance += amount;
    await user.save();
    
    // Create CREDIT transaction record
    await Payment.create({
      user: userId,
      amount,
      type: 'CREDIT',
      description: 'Wallet deposit via UPI',
      category: 'WALLET_DEPOSIT',
      currency: 'INR',
      paymentMode: 'wallet',
      status: 'VERIFIED',
      razorpayPaymentId: `upi_${Date.now()}_${userId.toString().slice(-6)}`,
    });

    return {
      success: true,
      newBalance: user.walletBalance,
      depositedAmount: amount,
      transactionId: `upi_${Date.now()}_${userId.toString().slice(-6)}`,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get wallet balance
 */
export const getWalletBalance = async (userId) => {
  try {
    const user = await User.findById(userId).select('walletBalance');
    if (!user) {
      throw new Error('User not found');
    }

    return {
      balance: user.walletBalance,
      userId: user._id,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get payment history for a user
 */
export const getPaymentHistory = async (userId) => {
  try {
    const payments = await Payment.find({ user: userId })
      .populate('booking', 'charger startTime endTime status')
      .sort({ createdAt: -1 })
      .limit(50);

    return payments;
  } catch (error) {
    throw error;
  }
};
