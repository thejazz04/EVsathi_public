import api from './api.js';

export const pricingService = {
  /**
   * Fetch dynamic pricing calculation for a specific charger.
   * Calls the actual backend pricing endpoint: GET /api/pricing/:chargerId/pricing
   * Does NOT provide any fake client-side price fallbacks.
   * 
   * @param {string} chargerId - The charger ID
   * @param {Object} options - Optional parameters
   * @param {string|Date} options.startTime - The start time for pricing calculation
   * @param {string|Date} options.endTime - The end time for pricing calculation
   */
  getPricingInfo: async (chargerId, options = {}) => {
    const params = {};
    if (options.startTime) {
      params.startTime = options.startTime instanceof Date 
        ? options.startTime.toISOString() 
        : options.startTime;
    }
    if (options.endTime) {
      params.endTime = options.endTime instanceof Date 
        ? options.endTime.toISOString() 
        : options.endTime;
    }
    const response = await api.get(`/pricing/${chargerId}/pricing`, { params });
    return response.data;
  },
};

export default pricingService;
