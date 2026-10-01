import logger from '../../utils/logger.js';

export class MlServiceError extends Error {
  constructor(message, code = 'ML_SERVICE_ERROR', statusCode = 500, details = null) {
    super(message);
    this.name = 'MlServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const getMlServiceUrl = () => {
  return process.env.ML_SERVICE_URL || 'http://localhost:8000';
};

export const getMlTimeoutMs = () => {
  const envVal = Number(process.env.ML_SERVICE_TIMEOUT);
  return Number.isFinite(envVal) && envVal > 0 ? envVal : 15000; // Increased from 5000 to 15000ms
};

export const isMlEnabled = () => {
  // ML is enabled unless explicitly set to 'false'
  return process.env.ML_ENABLED !== 'false';
};

/**
 * Dedicated ML Client for communicating with the FastAPI XGBoost inference service.
 *
 * Enforces:
 * - Explicit ML_ENABLED gate: Throws ML_SERVICE_DISABLED when disabled (NEVER returns fake fallback)
 * - Configurable ML_SERVICE_URL without hardcoding
 * - Strict request timeout (default 5000ms via AbortController)
 * - Exact Phase 4 schema contract (charger_id, timestamp, lag_1h, lag_24h, rolling_3h_mean)
 * - Safe observability logging
 * - Structured error propagation: NEVER returns null on failure
 */
export const predictDemandFromMlService = async ({
  charger_id,
  timestamp,
  lag_1h = null,
  lag_24h = null,
  rolling_3h_mean = null,
}) => {
  if (!isMlEnabled()) {
    logger.warn('ML demand prediction request rejected: ML_ENABLED=false');
    throw new MlServiceError(
      'Demand prediction service is currently disabled (ML_ENABLED=false)',
      'ML_SERVICE_DISABLED',
      503
    );
  }

  if (!charger_id || typeof charger_id !== 'string' || !charger_id.trim()) {
    throw new MlServiceError('Valid charger_id is required', 'ML_INVALID_CHARGER_ID', 400);
  }

  if (!timestamp) {
    throw new MlServiceError('Valid timestamp is required', 'ML_INVALID_TIMESTAMP', 400);
  }

  const payload = {
    charger_id: charger_id.trim().toUpperCase(),
    timestamp: typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString(),
    lag_1h: lag_1h !== null && lag_1h !== undefined ? Number(lag_1h) : null,
    lag_24h: lag_24h !== null && lag_24h !== undefined ? Number(lag_24h) : null,
    rolling_3h_mean: rolling_3h_mean !== null && rolling_3h_mean !== undefined ? Number(rolling_3h_mean) : null,
  };

  const baseUrl = getMlServiceUrl();
  const timeoutMs = getMlTimeoutMs();
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/predict-demand`;

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (error.name === 'AbortError') {
      logger.warn('ML service request timed out', {
        charger_id: payload.charger_id,
        timestamp: payload.timestamp,
        timeoutMs,
        latencyMs,
      });
      throw new MlServiceError(
        `ML demand prediction service timed out after ${timeoutMs}ms`,
        'ML_SERVICE_TIMEOUT',
        504
      );
    }

    logger.error('ML service connection failure', {
      charger_id: payload.charger_id,
      timestamp: payload.timestamp,
      error: error.message,
      latencyMs,
    });
    throw new MlServiceError(
      'Demand prediction service is currently unavailable or unreachable',
      'ML_SERVICE_UNAVAILABLE',
      503
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errBody = await response.json();
      errorDetail = typeof errBody.detail === 'string'
        ? errBody.detail
        : JSON.stringify(errBody.detail || errBody);
    } catch {
      errorDetail = await response.text().catch(() => '');
    }

    logger.warn('ML service returned error status', {
      charger_id: payload.charger_id,
      timestamp: payload.timestamp,
      status: response.status,
      errorDetail,
      latencyMs,
    });

    if (response.status === 404) {
      throw new MlServiceError(
        errorDetail || `Charging station '${payload.charger_id}' was not found in ML registry`,
        'ML_CHARGER_NOT_FOUND',
        404
      );
    }

    if (response.status === 422) {
      const isHistoryMissing = /historical|lag|rolling/i.test(errorDetail);
      throw new MlServiceError(
        errorDetail || 'Unprocessable prediction request: missing required historical demand lags',
        isHistoryMissing ? 'ML_INSUFFICIENT_HISTORY' : 'ML_VALIDATION_ERROR',
        422
      );
    }

    if (response.status >= 500) {
      throw new MlServiceError(
        'Internal error within ML prediction engine',
        'ML_INTERNAL_ERROR',
        502
      );
    }

    throw new MlServiceError(
      errorDetail || `ML service request failed with HTTP ${response.status}`,
      'ML_REQUEST_FAILED',
      response.status
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    logger.error('Failed to parse ML response JSON', {
      charger_id: payload.charger_id,
      error: error.message,
      latencyMs,
    });
    throw new MlServiceError('Malformed JSON received from ML service', 'ML_MALFORMED_RESPONSE', 502);
  }

  if (
    !data ||
    typeof data.predicted_demand !== 'number' ||
    Number.isNaN(data.predicted_demand)
  ) {
    logger.error('ML service response schema invalid', {
      charger_id: payload.charger_id,
      data,
      latencyMs,
    });
    throw new MlServiceError('Malformed response schema received from ML service', 'ML_MALFORMED_RESPONSE', 502);
  }

  logger.info('ML demand prediction succeeded', {
    charger_id: data.charger_id,
    timestamp: data.timestamp,
    status: response.status,
    latencyMs,
    predicted_demand: data.predicted_demand,
  });

  return {
    charger_id: data.charger_id,
    timestamp: data.timestamp,
    model_version: data.model_version || 'xgboost_demand_v1',
    model_name: data.model_name || null,
    forecast_type: data.forecast_type || null,
    predicted_demand: data.predicted_demand,
    features_used: data.features_used || {},
    disclaimer: data.disclaimer || null,
    latency_ms: latencyMs,
  };
};

/**
 * Backward-compatible invocation helper for other endpoints (e.g. /predict-demand).
 * Throws on failure — NEVER returns null as a signal to trigger fake demand.
 */
export const invokeMlService = async (endpoint, payload) => {
  if (endpoint === '/predict-demand') {
    return predictDemandFromMlService(payload);
  }

  if (!isMlEnabled()) {
    throw new MlServiceError('ML service is disabled (ML_ENABLED=false)', 'ML_SERVICE_DISABLED', 503);
  }

  const baseUrl = getMlServiceUrl();
  const timeoutMs = getMlTimeoutMs();
  const url = `${baseUrl.replace(/\/+$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new MlServiceError(`ML service HTTP ${response.status}`, 'ML_REQUEST_FAILED', response.status);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof MlServiceError) throw error;
    throw new MlServiceError(`ML service call failed: ${error.message}`, 'ML_SERVICE_UNAVAILABLE', 503);
  }
};

/**
 * Health check helper to query ML service readiness.
 */
export const checkMlServiceHealth = async () => {
  const baseUrl = getMlServiceUrl();
  const timeoutMs = Math.min(getMlTimeoutMs(), 3000);
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/health`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { status: 'error', statusCode: response.status, isAvailable: false };
    }

    const body = await response.json();
    return { status: 'ok', ...body, isAvailable: true };
  } catch (err) {
    clearTimeout(timeoutId);
    return { status: 'unavailable', error: err.message, isAvailable: false };
  }
};

/**
 * Phase 11 PPO Dynamic Pricing Shadow Inference Client.
 */
export const predictPpoPricingFromMlService = async (payload) => {
  if (!isMlEnabled()) {
    throw new MlServiceError('ML service is disabled (ML_ENABLED=false)', 'ML_SERVICE_DISABLED', 503);
  }

  const baseUrl = getMlServiceUrl();
  const timeoutMs = getMlTimeoutMs();
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/predict-ppo`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new MlServiceError(`PPO service HTTP ${response.status}`, 'ML_PPO_REQUEST_FAILED', response.status);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof MlServiceError) throw error;
    throw new MlServiceError(`PPO service call failed: ${error.message}`, 'ML_PPO_UNAVAILABLE', 503);
  }
};

