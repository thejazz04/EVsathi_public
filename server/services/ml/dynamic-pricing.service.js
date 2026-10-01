import PricingHistory from '../../models/PricingHistory.js';
import { predictPpoPricingFromMlService } from './ml.client.js';
import logger from '../../utils/logger.js';

/**
 * Phase 11 PPO Dynamic Pricing Service (SHADOW MODE EVALUATION ONLY).
 *
 * Core Principles:
 * 1. Executes PPO continuous policy prediction side-by-side with Phase 10 production pricing.
 * 2. PPO proposed prices NEVER override live driver/host rates or booking pricingSnapshot.
 * 3. Enforces Phase 10 price safety boundaries [0.5 * Base, 2.0 * Base].
 * 4. PPO errors or timeouts silently revert to shadow status FALLBACK without impacting pricing.
 */
export const computeDynamicPricing = async ({
  chargerId,
  basePrice = 40,
  predictedDemand = 0.50,
  hour = 12,
  isWeekend = false,
  isFastCharger = true,
  deterministicMultiplier = 1.0,
} = {}) => {
  const base = Number(basePrice) > 0 ? Number(basePrice) : 40;
  const demand = predictedDemand != null && !Number.isNaN(Number(predictedDemand))
    ? Number(predictedDemand)
    : 0.50;
  const hr = hour != null ? Number(hour) % 24 : 12;

  const minAllowed = Math.max(1, Math.round(base * 0.50));
  const maxAllowed = Math.round(base * 2.00);

  let ppoResult = null;
  let shadowStatus = 'ACTIVE';
  let fallbackReason = null;

  try {
    const rawResult = await predictPpoPricingFromMlService({
      predicted_demand: demand,
      base_price: base,
      hour: hr,
      is_weekend: Boolean(isWeekend),
      is_fast_charger: Boolean(isFastCharger),
      deterministic_multiplier: Number(deterministicMultiplier),
    });

    ppoResult = rawResult;
  } catch (err) {
    logger.warn('PPO shadow pricing service query unavailable, using fallback calculation', {
      chargerId,
      error: err.message,
    });
    shadowStatus = 'FALLBACK';
    fallbackReason = err.code || err.message;

    // Local PPO fallback estimation
    const rawMultiplier = 1.0 + 0.50 * (demand - 0.50);
    const rawPrice = Math.round(base * rawMultiplier);
    const clampedPrice = Math.min(maxAllowed, Math.max(minAllowed, rawPrice));

    ppoResult = {
      action: Number((demand - 0.50).toFixed(4)),
      proposed_multiplier: Number(rawMultiplier.toFixed(4)),
      proposed_price: clampedPrice,
      raw_price: rawPrice,
      min_allowed_price: minAllowed,
      max_allowed_price: maxAllowed,
      is_safety_clamped: clampedPrice !== rawPrice,
      model_version: 'ppo_pricing_v1_fallback',
      mode: 'SHADOW_EVALUATION',
    };
  }

  const productionPrice = Math.min(maxAllowed, Math.max(minAllowed, Math.round(base * Number(deterministicMultiplier))));

  logger.info('PPO Shadow Mode Evaluation', {
    chargerId: chargerId ? String(chargerId) : 'N/A',
    predictedDemand: demand,
    ppoProposedPrice: ppoResult.proposed_price,
    productionPrice,
    shadowStatus,
    fallbackReason,
  });

  return {
    success: true,
    shadowMode: true,
    shadowStatus,
    fallbackReason,
    data: {
      action: ppoResult.action,
      proposedMultiplier: ppoResult.proposed_multiplier,
      proposedPrice: ppoResult.proposed_price,
      rawPrice: ppoResult.raw_price,
      minAllowedPrice: ppoResult.min_allowed_price,
      maxAllowedPrice: ppoResult.max_allowed_price,
      isSafetyClamped: ppoResult.is_safety_clamped,
      productionPrice,
      modelVersion: ppoResult.model_version || 'ppo_pricing_v1',
      mode: 'SHADOW_EVALUATION',
      disclaimer: 'PPO Reinforcement Learning operates in Shadow Mode only. Phase 10 pricing remains production authority.',
    },
  };
};

export default {
  computeDynamicPricing,
};

