import api from './api.js';

export const reviewService = {
  create: async (payload) => {
    const response = await api.post('/reviews', payload);
    return response.data;
  },
  update: async (id, payload) => {
    const response = await api.put(`/reviews/${id}`, payload);
    return response.data;
  },
  remove: async (id) => {
    const response = await api.delete(`/reviews/${id}`);
    return response.data;
  },
  getByCharger: async (chargerId, params = {}) => {
    const response = await api.get(`/reviews/charger/${chargerId}`, { params });
    return response.data;
  },
  getByUser: async (userId) => {
    const response = await api.get(`/reviews/user/${userId}`);
    return response.data;
  },
};
