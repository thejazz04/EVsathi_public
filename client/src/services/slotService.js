import api from './api';

export const slotService = {
  // HOST: Get full Gantt chart data with all slot states
  getHostSlots: (chargerId, startDate, endDate) => 
    api.get(`/slots/host/${chargerId}`, { 
      params: { startDate, endDate } 
    }),

  // DRIVER: Get read-only Gantt chart (available/occupied only)
  getDriverSlots: (chargerId, startDate, endDate) => 
    api.get(`/slots/driver/${chargerId}`, { 
      params: { startDate, endDate } 
    }),

  // Get slot grid for charger detail page (driver view)
  getGrid: (chargerId, { days = 1, date } = {}) => {
    const startDate = date ? new Date(date).toISOString() : new Date().toISOString();
    const endDate = new Date(new Date(startDate).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    return api.get(`/slots/driver/${chargerId}`, { 
      params: { startDate, endDate } 
    });
  },

  // HOST: Block a time range
  blockTimeSlot: (chargerId, data) => 
    api.post(`/slots/host/${chargerId}/block`, data),

  // HOST: Unblock a slot
  unblockTimeSlot: (slotId) => 
    api.delete(`/slots/host/${slotId}/unblock`),

  // HOST: Update blocked slot details
  updateBlockedSlot: (slotId, data) => 
    api.put(`/slots/host/${slotId}`, data),

  // HOST: Generate available slots in bulk
  generateAvailableSlots: (chargerId, data) => 
    api.post(`/slots/host/${chargerId}/generate`, data),

  // Legacy/Compatibility methods for EditSlots.jsx
  updateSlot: (chargerId, slotId, data) => 
    api.put(`/slots/host/${slotId}`, data),

  deleteSlot: (chargerId, slotId) => 
    api.delete(`/slots/host/${slotId}/unblock`),

  generateFromTemplate: (chargerId, data) => 
    api.post(`/slots/host/${chargerId}/generate`, data),

  createSlot: (chargerId, data) => 
    api.post(`/slots/host/${chargerId}/block`, data),
};

export default slotService;
