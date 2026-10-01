import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';

export const topupWallet = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const topupAmount = Number(amount);

    if (!topupAmount || Number.isNaN(topupAmount) || topupAmount < 10) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'Minimum top-up amount is ₹10' },
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User account not found' },
      });
    }

    user.walletBalance = (user.walletBalance || 0) + topupAmount;
    await user.save();

    const payment = await Payment.create({
      user: user._id,
      amount: topupAmount,
      currency: 'INR',
      paymentMode: 'wallet',
      razorpayOrderId: `topup_order_${Date.now()}`,
      razorpayPaymentId: `pay_topup_${Date.now().toString().slice(-6)}`,
      status: 'VERIFIED',
    });

    res.status(200).json({
      success: true,
      data: {
        walletBalance: user.walletBalance,
        amount: topupAmount,
        payment,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getWalletTransactions = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Retrieve real payments for current user (both top-ups and bookings)
    const payments = await Payment.find({ user: userId }).sort({ createdAt: -1 });

    const bookings = await Booking.find({ driver: userId, paymentStatus: 'PAID' })
      .populate('charger', 'title location')
      .sort({ createdAt: -1 });

    const transactions = [];

    // 1. Add debit charging transactions
    bookings.forEach((b) => {
      transactions.push({
        _id: `tx_${b._id}`,
        type: 'DEBIT',
        amount: b.totalPrice,
        description: `Charging Session Payment - ${b.charger?.title || 'Residential Station'}`,
        date: b.createdAt,
        receiptId: b.paymentReceiptId || `RZP-${b._id.toString().slice(-6)}`,
        status: 'SUCCESS',
      });
    });

    // 2. Add credit top-up transactions (including promotional credit)
    payments.forEach((p) => {
      if (p.paymentMode === 'wallet' || !p.booking) {
        const isPromotional = p.razorpayPaymentId === 'pay_promo_welcome';
        transactions.push({
          _id: `tx_topup_${p._id}`,
          type: 'CREDIT',
          amount: p.amount,
          description: isPromotional ? 'EVsathi Promotional Welcome Credit' : 'EVsathi Wallet Top-Up',
          date: p.createdAt,
          receiptId: p.razorpayPaymentId || `RZP-TOPUP-${p._id.toString().slice(-5)}`,
          status: 'SUCCESS',
        });
      }
    });

    // Sort transactions chronologically descending
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const user = await User.findById(userId);

    res.status(200).json({
      success: true,
      data: {
        walletBalance: user?.walletBalance ?? req.user.walletBalance ?? 1500,
        transactions,
      },
    });
  } catch (error) {
    next(error);
  }
};
