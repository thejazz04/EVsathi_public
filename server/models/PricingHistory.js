import mongoose from 'mongoose';

const pricingHistorySchema = new mongoose.Schema(
  {
    charger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Charger',
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // State Vector for PPO RL Environment
    state: {
      predictedDemand: { type: Number, default: 0 },
      actualDemand: { type: Number, default: 0 },
      electricityTariff: { type: Number, default: 8.5 },
      gridCondition: { type: String, default: 'Optimal' },
      utilization: { type: Number, default: 0 },
      currentPrice: { type: Number, default: 15 },
    },
    // Action Taken by Pricing Engine
    action: {
      selectedPrice: { type: Number, required: true },
      pricingModel: { type: String, default: 'RULE_BASED' },
    },
    // Outcome Observed (Reward Computation)
    outcome: {
      sessionsCount: { type: Number, default: 0 },
      energyConsumedKwh: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      resultingUtilization: { type: Number, default: 0 },
      calculatedReward: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

export const PricingHistory = mongoose.model('PricingHistory', pricingHistorySchema);
export default PricingHistory;
