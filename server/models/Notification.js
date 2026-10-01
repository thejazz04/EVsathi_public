import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'BOOKING_CONFIRMED',
        'BOOKING_CANCELLED',
        'CHARGING_STARTED',
        'CHARGING_COMPLETED',
        'PAYMENT_VERIFIED',
        'PAYMENT_CONFIRMED',
        'CHARGER_STATUS',
        'NEW_MESSAGE',
        'UPCOMING_SESSION',
        'REVIEW_REMINDER',
      ],
      required: true,
    },
    data: { type: Object, default: {} },
    isRead: { type: Boolean, default: false },
    pushSent: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
