import mongoose from 'mongoose';
import DemandData from '../../models/DemandData.js';
import Charger from '../../models/Charger.js';
import { predictDemandFromMlService, MlServiceError } from './ml.client.js';
import logger from '../../utils/logger.js';

/**
 * Mapping of metropolitan regions to Phase 2/3 calibrated reference stations.
 */
export const METRO_CALIBRATION_MAPPING = {
  NCR: 'CHG-NCR-001',
  BLR: 'CHG-BLR-005',
  MUM: 'CHG-MUM-007',
  HYD: 'CHG-HYD-010',
  PUN: 'CHG-PUN-009',
  DEL: 'CHG-DEL-003',
  MYS: 'CHG-BLR-005', // Mysore region (mapped to Karnataka regional calibration hub)
  DEFAULT: 'CHG-NCR-001',
};

/**
 * Resolve charger input to a valid station identifier for inference.
 */
export const resolveCalibrationStationId = async (chargerId, latitude, longitude) => {
  if (typeof chargerId === 'string' && chargerId.toUpperCase().startsWith('CHG-')) {
    return chargerId.trim().toUpperCase();
  }

  if (chargerId && mongoose.Types.ObjectId.isValid(chargerId)) {
    const charger = await Charger.findById(chargerId).lean();
    if (charger) {
      // Check if charger has explicit station code or title starting with CHG-
      if (charger.stationCode && charger.stationCode.toUpperCase().startsWith('CHG-')) {
        return charger.stationCode.trim().toUpperCase();
      }
      if (charger.title && charger.title.toUpperCase().startsWith('CHG-')) {
        return charger.title.trim().toUpperCase();
      }
      
      // City/state-based mapping  
      const city = (charger.location?.city || '').toUpperCase();
      const state = (charger.location?.state || '').toUpperCase();
      const title = (charger.title || '').toUpperCase();
      
      // Map Mysore chargers to specific CHG-MYS-XXX codes based on title keywords
      if (city.includes('MYSORE') || city.includes('MYSURU') || city.includes('SRIRANGAPATNA')) {
        // Map based on location/title to specific Mysore station codes (order matters - most specific first)
        if (title.includes('PALACE')) return 'CHG-MYS-001';
        if (title.includes('CHAMUNDI') || title.includes('HILLS')) return 'CHG-MYS-002';
        if (title.includes('KRS') || title.includes('DAM')) return 'CHG-MYS-003';
        if (title.includes('INFOSYS')) return 'CHG-MYS-004';
        if (title.includes('MALL')) return 'CHG-MYS-005';
        if (title.includes('RAILWAY')) return 'CHG-MYS-006';
        if (title.includes('BRINDAVAN') || title.includes('GARDEN')) return 'CHG-MYS-007';
        if (title.includes('GOKULAM')) return 'CHG-MYS-008';
        if (title.includes('UNIVERSITY')) return 'CHG-MYS-009';
        if (title.includes('DEVARAJA') || title.includes('MARKET')) return 'CHG-MYS-010';
        if (title.includes('ZOO')) return 'CHG-MYS-011';
        if (title.includes('JAYALAKSHMI')) return 'CHG-MYS-012';
        if (title.includes('HIGHWAY')) return 'CHG-MYS-013';
        if (title.includes('HUNSUR')) return 'CHG-MYS-014';
        if (title.includes('KUKKARAHALLI')) return 'CHG-MYS-015';
        if (title.includes('LINGAMBUDHI') || title.includes('CFTRI')) return 'CHG-MYS-016';
        // Default Mysore mapping if no specific match
        return METRO_CALIBRATION_MAPPING.MYS;
      }
      if (city.includes('DELHI') || city.includes('NOIDA') || city.includes('GURGAON') || state.includes('DELHI')) {
        return METRO_CALIBRATION_MAPPING.NCR;
      }
      if (city.includes('BANGALORE') || city.includes('BENGALURU')) {
        return METRO_CALIBRATION_MAPPING.BLR;
      }
      if (city.includes('MUMBAI') || state.includes('MAHARASHTRA')) {
        return METRO_CALIBRATION_MAPPING.MUM;
      }
      if (city.includes('HYDERABAD') || state.includes('TELANGANA')) {
        return METRO_CALIBRATION_MAPPING.HYD;
      }
      if (city.includes('PUNE')) {
        return METRO_CALIBRATION_MAPPING.PUN;
      }
      // Karnataka (non-Mysore, non-Bangalore) defaults to BLR
      if (state.includes('KARNATAKA')) {
        return METRO_CALIBRATION_MAPPING.BLR;
      }
    }
  }

  // Coordinate-based heuristic
  if (latitude != null && longitude != null) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    // Mysore region: lat ~12.2-12.5, lng ~76.5-76.7
    if (lat >= 12.2 && lat <= 12.5 && lng >= 76.5 && lng <= 76.8) return METRO_CALIBRATION_MAPPING.MYS;
    // NCR region
    if (lat >= 28.0 && lat <= 29.0 && lng >= 76.5 && lng <= 77.8) return METRO_CALIBRATION_MAPPING.NCR;
    // Bangalore region  
    if (lat >= 12.8 && lat <= 13.2 && lng >= 77.4 && lng <= 77.8) return METRO_CALIBRATION_MAPPING.BLR;
    // Mumbai region
    if (lat >= 18.5 && lat <= 19.5 && lng >= 72.5 && lng <= 73.5) return METRO_CALIBRATION_MAPPING.MUM;
    // Hyderabad region
    if (lat >= 17.0 && lat <= 18.0 && lng >= 78.0 && lng <= 79.0) return METRO_CALIBRATION_MAPPING.HYD;
    // Pune region
    if (lat >= 18.0 && lat <= 19.0 && lng >= 73.5 && lng <= 74.5) return METRO_CALIBRATION_MAPPING.PUN;
  }

  return METRO_CALIBRATION_MAPPING.DEFAULT;
};

/**
 * Query genuine historical observations from MongoDB DemandData collection.
 * Strict zero-fabrication: Only returns compatible normalized demand values.
 */
export const queryGenuineHistoricalLags = async (chargerId, targetDate) => {
  if (!mongoose.Types.ObjectId.isValid(chargerId)) {
    return { lag_1h: null, lag_24h: null, rolling_3h_mean: null };
  }

  try {
    const t = new Date(targetDate).getTime();
    const oneHourMs = 3600 * 1000;
    const toleranceMs = 15 * 60 * 1000;

    const findObservationNear = async (targetTimestamp) => {
      const minTime = new Date(targetTimestamp - toleranceMs);
      const maxTime = new Date(targetTimestamp + toleranceMs);

      const record = await DemandData.findOne({
        charger: chargerId,
        timestamp: { $gte: minTime, $lte: maxTime },
        qualityStatus: { $in: ['VALID', null] },
      })
        .sort({ timestamp: -1 })
        .lean();

      if (!record || record.qualityStatus === 'QUARANTINED' || record.qualityStatus === 'INVALID') {
        return null;
      }

      // Strict target compatibility: demandValue must be present and numeric
      return typeof record.demandValue === 'number' ? record.demandValue : null;
    };

    const lag_1h = await findObservationNear(t - 1 * oneHourMs);
    const lag_24h = await findObservationNear(t - 24 * oneHourMs);

    const d3 = await findObservationNear(t - 3 * oneHourMs);
    const d2 = await findObservationNear(t - 2 * oneHourMs);
    const d1 = lag_1h;

    let rolling_3h_mean = null;
    if (d1 !== null && d2 !== null && d3 !== null) {
      rolling_3h_mean = Number(((d1 + d2 + d3) / 3).toFixed(4));
    }

    return { lag_1h, lag_24h, rolling_3h_mean };
  } catch (error) {
    logger.warn('Failed to query DemandData for historical lags', { error: error.message, chargerId });
    return { lag_1h: null, lag_24h: null, rolling_3h_mean: null };
  }
};

/**
 * Predict EV Charging Demand using the XGBoost ML Service.
 *
 * Strict Zero-Fabrication Flow:
 * A. Resolve charger / calibration station identifier.
 * B. Obtain genuine historical lag values if available.
 * C. If complete compatible lags exist: call FastAPI.
 * D. If lags do not exist and FastAPI cannot resolve reference history: return structured 422.
 * E. If FastAPI fails: propagate structured ML error.
 * F. If FastAPI succeeds: return XGBoost prediction.
 *
 * NEVER falls back to 0.5, heuristics, or fake DemandData insertion.
 */
export const predictDemand = async ({
  chargerId,
  latitude,
  longitude,
  timestamp,
  lag_1h,
  lag_24h,
  rolling_3h_mean,
}) => {
  const date = timestamp ? new Date(timestamp) : new Date();
  if (isNaN(date.getTime())) {
    throw new MlServiceError('Valid timestamp is required', 'ML_INVALID_TIMESTAMP', 400);
  }

  // A. Resolve station identifier
  const targetStationId = await resolveCalibrationStationId(chargerId, latitude, longitude);

  // B. Resolve historical lags
  let resolvedLag1h = lag_1h != null ? Number(lag_1h) : null;
  let resolvedLag24h = lag_24h != null ? Number(lag_24h) : null;
  let resolvedRolling3h = rolling_3h_mean != null ? Number(rolling_3h_mean) : null;

  if (resolvedLag1h === null || resolvedLag24h === null || resolvedRolling3h === null) {
    const dbLags = await queryGenuineHistoricalLags(chargerId, date);
    if (resolvedLag1h === null) resolvedLag1h = dbLags.lag_1h;
    if (resolvedLag24h === null) resolvedLag24h = dbLags.lag_24h;
    if (resolvedRolling3h === null) resolvedRolling3h = dbLags.rolling_3h_mean;
  }

  let formattedTimestamp;
  if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(timestamp.trim())) {
    formattedTimestamp = timestamp.trim().replace('T', ' ');
    if (formattedTimestamp.length === 16) formattedTimestamp += ':00';
    if (formattedTimestamp.length > 19) formattedTimestamp = formattedTimestamp.slice(0, 19);
  } else {
    formattedTimestamp = date.toISOString().replace('T', ' ').slice(0, 19);
  }

  // C. Call FastAPI ML service
  // Note: If lags are null, FastAPI will attempt reference-data lookup; if still missing, FastAPI returns 422.
  const mlResponse = await predictDemandFromMlService({
    charger_id: targetStationId,
    timestamp: formattedTimestamp,
    lag_1h: resolvedLag1h,
    lag_24h: resolvedLag24h,
    rolling_3h_mean: resolvedRolling3h,
  });

  // F. Return XGBoost prediction
  return {
    demandValue: Number(mlResponse.predicted_demand),
    chargerId: chargerId || targetStationId,
    calibrationStationId: mlResponse.charger_id,
    timestamp: mlResponse.timestamp,
    modelVersion: mlResponse.model_version,
    modelName: mlResponse.model_name,
    forecastType: mlResponse.forecast_type,
    source: 'XGBOOST_MODEL_SERVICE',
    featuresUsed: mlResponse.features_used,
    disclaimer: mlResponse.disclaimer,
    latencyMs: mlResponse.latency_ms,
  };
};

export default {
  predictDemand,
  resolveCalibrationStationId,
  queryGenuineHistoricalLags,
};
