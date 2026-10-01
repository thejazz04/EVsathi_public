import api from './api.js';

export const bookingService = {
  create: async (bookingData) => {
    const response = await api.post('/bookings', bookingData);
    return response.data;
  },

  createBooking: async (bookingData) => {
    const response = await api.post('/bookings', bookingData);
    return response.data;
  },

  getAll: async (params = {}) => {
    const response = await api.get('/bookings', { params });
    return response.data;
  },

  getMyBookings: async (params = {}) => {
    const response = await api.get('/bookings', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/bookings/${id}`);
    return response.data;
  },

  cancel: async (id, reason) => {
    const response = await api.put(`/bookings/${id}/cancel`, { reason });
    return response.data;
  },

  checkIn: async (id) => {
    const response = await api.put(`/bookings/${id}/checkin`);
    return response.data;
  },

  checkOut: async (id) => {
    const response = await api.put(`/bookings/${id}/checkout`);
    return response.data;
  },

  getUpcoming: async () => {
    const response = await api.get('/bookings/upcoming');
    return response.data;
  },

  getPast: async () => {
    const response = await api.get('/bookings/past');
    return response.data;
  },

  getMyRentals: async () => {
    const response = await api.get('/bookings/my-rentals');
    return response.data;
  },
};

export default bookingService;
