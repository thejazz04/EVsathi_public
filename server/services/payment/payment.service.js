import crypto from 'crypto';
import Payment from '../../models/Payment.js';
import Booking from '../../models/Booking.js';
import { getRazorpayInstance, isMockPayment } from '../../config/razorpay.js';
import logger from '../../utils/logger.js';

export const createPaymentOrder = async ({ bookingId, userId, amount }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new Error('Booking not found');
  }

  const orderAmount = amount || booking.totalPrice;

  // Mock Payment Mode Handling (Dev Only)
  if (isMockPayment()) {
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const payment = await Payment.create({
      booking: booking._id,
      user: userId,
      amount: orderAmount,
      currency: 'INR',
      paymentMode: 'mock',
      razorpayOrderId: mockOrderId,
      status: 'CREATED',
    });

    return {
      orderId: mockOrderId,
      amount: orderAmount * 100, // paise
      currency: 'INR',
      keyId: 'rzp_test_mock_key',
      paymentMode: 'mock',
      paymentId: payment._id,
    };
  }

  // Live Razorpay SDK Integration
  const razorpay = getRazorpayInstance();
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(orderAmount * 100), // convert to paise
    currency: 'INR',
    receipt: `rcpt_${booking._id.toString().slice(-8)}`,
    notes: { bookingId: booking._id.toString(), userId: userId.toString() },
  });

  const payment = await Payment.create({
    booking: booking._id,
    user: userId,
    amount: orderAmount,
    currency: 'INR',
    paymentMode: 'razorpay',
    razorpayOrderId: razorpayOrder.id,
    status: 'CREATED',
  });

  return {
    orderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    paymentMode: 'razorpay',
    paymentId: payment._id,
  };
};

export const verifyPaymentSignature = async ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  bookingId,
}) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new Error('Booking not found');
  }

  if (isMockPayment() || razorpayOrderId.startsWith('order_mock_')) {
    booking.status = 'CONFIRMED';
    booking.paymentStatus = 'PAID';
    booking.paymentReceiptId = `RZP-MOCK-${Date.now().toString().slice(-6)}`;
    await booking.save();

    await Payment.findOneAndUpdate(
      { razorpayOrderId },
      { status: 'VERIFIED', razorpayPaymentId: `pay_mock_${Date.now()}` }
    );

    return { verified: true, booking };
  }

  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body.toString())
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    throw new Error('Invalid Razorpay payment signature verification failed');
  }

  booking.status = 'CONFIRMED';
  booking.paymentStatus = 'PAID';
  booking.paymentReceiptId = `RZP-${razorpayPaymentId.slice(-8)}`;
  await booking.save();

  await Payment.findOneAndUpdate(
    { razorpayOrderId },
    { status: 'VERIFIED', razorpayPaymentId, razorpaySignature }
  );

  return { verified: true, booking };
};

export const processWebhookEvent = async (rawBody, signatureHeader) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signatureHeader) {
    throw new Error('Webhook signature verification failed');
  }

  const eventPayload = JSON.parse(rawBody.toString());
  const eventId = eventPayload.event_id;
  const eventType = eventPayload.event;

  logger.info(`Processing Razorpay Webhook Event: ${eventType} (${eventId})`);

  // Idempotency Check
  const existingPayment = await Payment.findOne({
    'webhookEventLogs.eventId': eventId,
  });

  if (existingPayment) {
    logger.info(`Webhook event ${eventId} already processed (Idempotent skip)`);
    return { status: 'already_processed' };
  }

  if (eventType === 'payment.captured') {
    const paymentEntity = eventPayload.payload.payment.entity;
    const orderId = paymentEntity.order_id;
    const paymentId = paymentEntity.id;

    const payment = await Payment.findOne({ razorpayOrderId: orderId });
    if (payment) {
      payment.status = 'VERIFIED';
      payment.razorpayPaymentId = paymentId;
      payment.webhookEventLogs.push({ eventId, eventType });
      await payment.save();

      await Booking.findByIdAndUpdate(payment.booking, {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        paymentReceiptId: `RZP-${paymentId.slice(-8)}`,
      });
    }
  }

  return { status: 'success' };
};
