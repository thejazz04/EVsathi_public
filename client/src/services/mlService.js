import api from './api.js';

export const mlService = {
  /**
   * Fetch current system ML status
   * GET /api/ml/status
   */
  getMlStatus: async () => {
    const response = await api.get('/ml/status');
    return response.data;
  },

  /**
   * Request demand prediction for a specific charger or location at a given timestamp.
   * Note: The frontend does NOT fabricate lag values. The backend is responsible
   * for resolving genuine historical telemetry and determining whether XGBoost or
   * rule-based fallback is applied.
   * GET /api/ml/demand
   */
  getDemandPrediction: async ({ chargerId, latitude, longitude, timestamp } = {}) => {
    const params = {};
    if (chargerId) params.chargerId = chargerId;
    if (latitude != null) params.latitude = latitude;
    if (longitude != null) params.longitude = longitude;
    if (timestamp) params.timestamp = timestamp;

    const response = await api.get('/ml/demand', { params });
    return response.data;
  },
};

export default mlService;
