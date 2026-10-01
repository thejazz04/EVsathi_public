import api from './api.js';

export const notificationService = {
  getNotifications: async () => {
    const response = await api.get('/notifications');
    return response.data;
  },

  markAsRead: async (notificationId = null) => {
    const payload = notificationId ? { notificationId } : {};
    const response = await api.patch('/notifications/read', payload);
    return response.data;
  },
};

export default notificationService;
