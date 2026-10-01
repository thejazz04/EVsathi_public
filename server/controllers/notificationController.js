import Notification from '../models/Notification.js';

export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.body || {};
    const query = { recipient: req.user._id, isRead: false };
    if (notificationId) {
      query._id = notificationId;
    }
    await Notification.updateMany(query, { $set: { isRead: true } });

    res.status(200).json({
      success: true,
      message: 'Notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};
