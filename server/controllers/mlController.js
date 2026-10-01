import { predictDemand } from '../services/ml/demand.service.js';
import { computeDynamicPricing } from '../services/ml/dynamic-pricing.service.js';
import { checkMlServiceHealth, getMlServiceUrl, isMlEnabled } from '../services/ml/ml.client.js';

/**
 * GET /api/ml/status
 * Check configuration and health of the ML Inference service.
 */
export const getMlStatus = async (req, res, next) => {
  try {
    const health = await checkMlServiceHealth();
    res.status(200).json({
      success: true,
      data: {
        mlEnabled: isMlEnabled(),
        mlServiceUrl: getMlServiceUrl(),
        mlServiceStatus: health.status,
        mlServiceDetails: health,
        model: 'xgboost_demand_v1',
        disclaimer: 'XGBoost Demand Model v1 — Synthetic Benchmark. Real-world validation not yet ready.',
        pricingModelStatus: 'SHADOW_EVALUATION',
        ppoPricingModelStatus: 'ACTIVE_SHADOW_MODE',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ml/demand/:chargerId OR GET /api/ml/demand
 * Retrieve EV charging demand prediction for a specific charger or coordinates.
 */
export const getDemandForecast = async (req, res, next) => {
  try {
    const chargerId = req.params.chargerId || req.query.charger_id || req.query.chargerId;
    const { timestamp, lag_1h, lag_24h, rolling_3h_mean, latitude, longitude } = req.query;

    const result = await predictDemand({
      chargerId,
      latitude: latitude != null ? Number(latitude) : undefined,
      longitude: longitude != null ? Number(longitude) : undefined,
      timestamp,
      lag_1h: lag_1h != null ? Number(lag_1h) : undefined,
      lag_24h: lag_24h != null ? Number(lag_24h) : undefined,
      rolling_3h_mean: rolling_3h_mean != null ? Number(rolling_3h_mean) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ml/demand
 * Retrieve EV charging demand prediction accepting full Phase 4 payload in JSON body.
 */
export const postDemandForecast = async (req, res, next) => {
  try {
    const {
      charger_id,
      chargerId,
      timestamp,
      lag_1h,
      lag_24h,
      rolling_3h_mean,
      latitude,
      longitude,
    } = req.body || {};

    const targetChargerId = charger_id || chargerId;

    const result = await predictDemand({
      chargerId: targetChargerId,
      latitude: latitude != null ? Number(latitude) : undefined,
      longitude: longitude != null ? Number(longitude) : undefined,
      timestamp,
      lag_1h: lag_1h != null ? Number(lag_1h) : undefined,
      lag_24h: lag_24h != null ? Number(lag_24h) : undefined,
      rolling_3h_mean: rolling_3h_mean != null ? Number(rolling_3h_mean) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ml/demand/:chargerId/24hour
 * Get 24-hour demand forecast for a specific charger
 * Optimized with parallel API calls
 */
export const get24HourDemandForecast = async (req, res, next) => {
  try {
    const chargerId = req.params.chargerId;
    const { date } = req.query; // Optional: specific date, defaults to today
    
    const targetDate = date ? new Date(date) : new Date();
    
    // Generate all 24 timestamps
    const timestamps = Array.from({ length: 24 }, (_, hour) => {
      const timestamp = new Date(targetDate);
      timestamp.setHours(hour, 0, 0, 0);
      return { hour, timestamp: timestamp.toISOString() };
    });
    
    // Make all 24 predictions in parallel (much faster!)
    const predictionPromises = timestamps.map(async ({ hour, timestamp }) => {
      try {
        const result = await predictDemand({
          chargerId,
          timestamp,
        });
        
        return {
          hour,
          timestamp,
          demandValue: result.demandValue || 0,
          source: result.source,
        };
      } catch (error) {
        console.warn(`Failed to get prediction for hour ${hour}:`, error.message);
        return {
          hour,
          timestamp,
          demandValue: null,
          source: 'ERROR',
          error: error.message,
        };
      }
    });
    
    // Wait for all predictions to complete
    const predictions = await Promise.all(predictionPromises);
    
    res.status(200).json({
      success: true,
      data: {
        chargerId,
        date: targetDate.toISOString().split('T')[0],
        predictions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ml/dynamic-pricing
 * Phase 11 PPO Dynamic Pricing Shadow Evaluation Endpoint.
 * Evaluates experimental PPO policy decisions in Shadow Mode without overriding live rates.
 */
export const getDynamicPricingEstimate = async (req, res, next) => {
  try {
    const result = await computeDynamicPricing(req.body || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

