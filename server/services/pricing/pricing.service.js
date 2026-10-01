import Pricing from '../../models/Pricing.js';
import Charger from '../../models/Charger.js';
import PricingHistory from '../../models/PricingHistory.js';
import { predictDemand } from '../ml/demand.service.js';
import logger from '../../utils/logger.js';

/**
 * DETERMINISTIC RULE-BASED PRICING ENGINE WITH XGBOOST ADVISORY DEMAND
 *
 * Core Principle:
 * XGBoost predicts DEMAND (predictedDemand in [0.00, 1.00]), NOT the final price.
 * The rule-based pricing system remains the authoritative pricing engine,
 * consuming predictedDemand as an advisory surge signal.
 *
 * Price Formula:
 * Price = Clamp(BasePrice * (1 + SurgeWeight * (DemandFactor - 1.0)) * TimeMultiplier * HolidayMultiplier, [0.5*Base, 2.0*Base])
 */
export const getPrice = async ({
  chargerId,
  startTime,
  endTime,
  demandFactor = null,
  isHoliday = false,
}) => {
  const charger = await Charger.findById(chargerId);
  if (!charger) {
    throw new Error('Charger not found');
  }

  let pricing = await Pricing.findOne({ charger: chargerId });
  if (!pricing) {
    pricing = {
      basePricePerHour: charger.pricePerHour || 25,
      surgeMultiplierWeight: 0.5,
      weekendMultiplier: 1.2,
      holidayMultiplier: 1.3,
    };
  }

  const base = pricing.basePricePerHour || charger.pricePerHour || 25;
  const surgeWeight = pricing.surgeMultiplierWeight != null ? pricing.surgeMultiplierWeight : 0.5;

  const targetTime = startTime ? new Date(startTime) : new Date();
  const startHour = targetTime.getHours();

  let effectiveDemandFactor = demandFactor;
  let pricingAlgorithm = 'RULE_BASED_PRICING';
  let predictedDemand = null;
  let modelVersion = null;
  let mlStatus = 'FALLBACK';
  let fallbackReason = null;
  let mlLatencyMs = null;

  // 1. Resolve demandFactor via ML if not explicitly supplied by caller
  if (effectiveDemandFactor == null) {
    try {
      const mlResult = await predictDemand({
        chargerId,
        latitude: charger.location?.coordinates?.[1] || charger.location?.latitude,
        longitude: charger.location?.coordinates?.[0] || charger.location?.longitude,
        timestamp: targetTime,
      });

      if (
        mlResult &&
        typeof mlResult.demandValue === 'number' &&
        !Number.isNaN(mlResult.demandValue) &&
        Number.isFinite(mlResult.demandValue) &&
        mlResult.demandValue >= 0.0 &&
        mlResult.demandValue <= 1.0
      ) {
        predictedDemand = Number(mlResult.demandValue.toFixed(4));
        modelVersion = mlResult.modelVersion || 'xgboost_demand_v1';
        mlLatencyMs = mlResult.latencyMs || null;

        // Bounded demand mapping:
        // 0.05 (off-peak) -> ~0.80, 0.50 (neutral) -> 1.00, 0.75+ (peak rush) -> up to 1.50
        const rawFactor = 1.0 + 2.0 * (predictedDemand - 0.50);
        effectiveDemandFactor = Number(Math.min(1.5, Math.max(0.8, rawFactor)).toFixed(2));
        
        // CRITICAL: Mark as XGBOOST_ADVISORY when ML prediction succeeds
        pricingAlgorithm = 'XGBOOST_ADVISORY_RULE_BASED';
        mlStatus = 'ACTIVE';
        fallbackReason = null;
      } else {
        throw new Error('Invalid ML prediction output bounds');
      }
    } catch (err) {
      logger.warn('ML demand prediction unavailable for pricing, using rule-based fallback', {
        chargerId,
        error: err.message,
        code: err.code || 'ML_PREDICTION_FAILED',
      });
      // Fallback to neutral demand when ML unavailable
      effectiveDemandFactor = 1.0;
      pricingAlgorithm = 'RULE_BASED_PRICING';
      predictedDemand = null;
      modelVersion = null;
      mlStatus = 'FALLBACK';
      fallbackReason = err.code || err.message;
    }
  } else {
    // Explicit demandFactor passed in (e.g. testing or manual override)
    const numericInput = Number(effectiveDemandFactor);
    if (Number.isNaN(numericInput) || !Number.isFinite(numericInput)) {
      effectiveDemandFactor = 1.0;
    } else {
      effectiveDemandFactor = Number(Math.min(1.5, Math.max(0.8, numericInput)).toFixed(2));
    }
    // When demandFactor is explicitly provided, it's rule-based override
    pricingAlgorithm = 'RULE_BASED_PRICING';
    mlStatus = 'BYPASSED';
  }

  // 2. ML-DRIVEN DEMAND-BASED PRICING
  // Let ML predictions determine surge/discount - NO hardcoded time rules
  // The XGBoost model learns peak/off-peak patterns from historical data
  
  const surgeComponent = 1 + surgeWeight * (effectiveDemandFactor - 1.0);
  
  // ML demand determines the price multiplier:
  // - High ML demand (>1.2) = Peak pricing
  // - Normal ML demand (0.9-1.2) = Standard pricing  
  // - Low ML demand (<0.9) = Off-peak discounts
  // The model learns WHEN these occur from training data
  
  const holidayMultiplier = isHoliday ? (pricing.holidayMultiplier || 1.3) : 1.0;

  const rawCalculatedPrice = Math.round(base * surgeComponent * holidayMultiplier);

  // 3. Strict Price Safety Boundaries: [0.5 * Base, 2.0 * Base]
  const minAllowedPrice = Math.max(1, Math.round(base * 0.5));
  const maxAllowedPrice = Math.round(base * 2.0);
  const calculatedPricePerHour = Math.min(maxAllowedPrice, Math.max(minAllowedPrice, rawCalculatedPrice));

  // 4. Operational Logging & History Recording
  logger.info('Calculated dynamic price', {
    chargerId: String(chargerId),
    predictedDemand,
    demandMultiplier: Number(surgeComponent.toFixed(2)),
    pricingAlgorithm,
    finalPrice: calculatedPricePerHour,
    mlLatencyMs,
    fallbackReason,
  });

  try {
    await PricingHistory.create({
      charger: charger._id || chargerId,
      timestamp: targetTime,
      state: {
        predictedDemand: predictedDemand != null ? predictedDemand : 0,
        currentPrice: base,
      },
      action: {
        selectedPrice: calculatedPricePerHour,
        pricingModel: pricingAlgorithm,
      },
    });
  } catch (histErr) {
    logger.warn('Failed to persist PricingHistory record', {
      chargerId: String(chargerId),
      error: histErr.message,
    });
  }

  return {
    basePrice: base,
    recommendedPrice: calculatedPricePerHour,
    demandFactor: effectiveDemandFactor,
    demandMultiplier: Number(surgeComponent.toFixed(2)),
    pricingAlgorithm,
    predictedDemand,
    modelVersion,
    mlStatus,
    fallbackReason,
  };
};


/**
 * SLOT DISPLAY PRICE — Lightweight Deterministic Per-Slot Price Annotation
 *
 * Used exclusively by the slot grid endpoint to annotate each slot with a
 * base price. For accurate ML-driven pricing, clients should call getPrice()
 * with the actual slot time.
 *
 * @param {number} basePricePerHour  - Charger base hourly rate (₹)
 * @param {Date|string} slotStartTime - Start time of the slot
 * @param {number} durationHours     - Duration of the slot in hours
 * @returns {number}                 - Rounded slot price (₹)
 */
export const computeSlotDisplayPrice = (basePricePerHour, slotStartTime, durationHours = 1) => {
  const base = Number(basePricePerHour) || 25;
  
  // Simple base price calculation
  // Clients should fetch ML-driven pricing via getPrice() API for accurate prices
  const rawPrice = base * Math.max(0.5, durationHours);

  // Safety clamp [0.5x, 2x] base
  const minPrice = Math.max(1, Math.round(base * 0.5));
  const maxPrice = Math.round(base * 2.0);

  return Math.min(maxPrice, Math.max(minPrice, Math.round(rawPrice)));
};
