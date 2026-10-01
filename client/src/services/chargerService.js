import api from './api.js';

export const chargerService = {
  getAll: async (params = {}) => {
    const response = await api.get('/chargers', { params });
    return response.data;
  },

  getChargers: async (params = {}) => {
    const response = await api.get('/chargers', { params });
    return response.data;
  },

  search: async (params) => {
    const response = await api.get('/chargers/search', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/chargers/${id}`);
    return response.data;
  },

  getCharger: async (id) => {
    const response = await api.get(`/chargers/${id}`);
    return response.data;
  },

  create: async (chargerData) => {
    const response = await api.post('/chargers', chargerData);
    return response.data;
  },

  update: async (id, chargerData) => {
    const response = await api.put(`/chargers/${id}`, chargerData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/chargers/${id}`);
    return response.data;
  },

  getMyChargers: async () => {
    const response = await api.get('/chargers/my-chargers');
    return response.data;
  },

  checkAvailability: async (id, startTime, endTime) => {
    const response = await api.get(`/chargers/${id}/availability`, {
      params: { startTime, endTime },
    });
    return response.data;
  },

  disable: async (id, payload) => {
    const response = await api.post(`/chargers/${id}/disable`, payload);
    return response.data;
  },

  // Earnings endpoints
  getChargerEarnings: async (id, params = {}) => {
    const response = await api.get(`/chargers/${id}/earnings`, { params });
    return response.data;
  },

  getMyEarningsSummary: async () => {
    const response = await api.get('/chargers/my-earnings');
    return response.data;
  },
};

export default chargerService;
