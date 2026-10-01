import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    // Transaction type: DEBIT (payment out), CREDIT (money in), REFUND (money back)
    type: {
      type: String,
      enum: ['DEBIT', 'CREDIT', 'REFUND'],
      default: 'DEBIT',
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      enum: ['BOOKING_PAYMENT', 'WALLET_DEPOSIT', 'HOST_EARNING', 'REFUND', 'PROMOTIONAL_CREDIT', 'OTHER'],
      default: 'OTHER',
    },
    currency: {
      type: String,
      default: 'INR',
    },
    paymentMode: {
      type: String,
      enum: ['razorpay', 'mock', 'wallet'],
      required: true,
    },
    razorpayOrderId: {
      type: String,
      unique: true,
      sparse: true,
    },
    razorpayPaymentId: {
      type: String,
      default: '',
    },
    razorpaySignature: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['CREATED', 'VERIFIED', 'FAILED', 'REFUNDED'],
      default: 'CREATED',
      index: true,
    },
    webhookEventLogs: [
      {
        eventId: String,
        eventType: String,
        processedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
