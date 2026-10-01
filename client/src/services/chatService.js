import api from './api.js';

export const chatService = {
  startOrUpgrade: async ({ chargerId, bookingId }) => {
    const response = await api.post('/chats', { chargerId, bookingId });
    return response.data;
  },
  list: async (params = {}) => {
    const response = await api.get('/chats', { params });
    return response.data;
  },
  getMessages: async (chatId) => {
    const response = await api.get(`/chats/${chatId}/messages`);
    return response.data;
  },
  sendMessage: async (chatId, messageText) => {
    const response = await api.post(`/chats/${chatId}/messages`, { messageText });
    return response.data;
  },
  markRead: async (chatId) => {
    const response = await api.patch(`/chats/${chatId}/read`);
    return response.data;
  },
  report: async (chatId, reason) => {
    const response = await api.post(`/chats/${chatId}/report`, { reason });
    return response.data;
  },
};
