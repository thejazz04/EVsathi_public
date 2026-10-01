import Notification from '../../models/Notification.js';
import User from '../../models/User.js';
import { getFirebaseAdmin } from '../../config/firebase.js';
import { emitToUser } from '../../config/socket.js';
import logger from '../../utils/logger.js';

export const sendNotification = async ({ recipientId, title, message, type, data = {} }) => {
  const notif = await Notification.create({
    recipient: recipientId,
    title,
    message,
    type,
    data,
  });

  // 1. Emit via Socket.IO for in-app instant UI alert
  emitToUser(recipientId, 'notification:received', notif);

  // 2. Send Push Notification via Firebase Admin SDK if token exists
  const firebaseAdmin = getFirebaseAdmin();
  if (firebaseAdmin) {
    const user = await User.findById(recipientId);
    if (user && user.fcmToken) {
      try {
        await firebaseAdmin.messaging().send({
          token: user.fcmToken,
          notification: { title, body: message },
          data: { type, ...data },
        });
        notif.pushSent = true;
        await notif.save();
        logger.info(`Firebase push notification sent to user ${recipientId}`);
      } catch (err) {
        logger.warn('Failed to send Firebase FCM push notification', { error: err.message });
      }
    }
  }

  return notif;
};
