import mongoose from 'mongoose';

const pricingSchema = new mongoose.Schema(
  {
    charger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Charger',
      required: true,
      unique: true,
    },
    basePricePerHour: {
      type: Number,
      required: true,
      default: 25,
    },
    basePricePerKwh: {
      type: Number,
      default: 15,
    },
    surgeMultiplierWeight: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1,
    },
    timeOfDayRules: [
      {
        startHour: { type: Number, required: true },
        endHour: { type: Number, required: true },
        multiplier: { type: Number, default: 1.0 },
      },
    ],
    weekendMultiplier: {
      type: Number,
      default: 1.2,
    },
    holidayMultiplier: {
      type: Number,
      default: 1.3,
    },
    pricingAlgorithm: {
      type: String,
      enum: ['RULE_BASED_PRICING', 'ML_PPO_PRICING'],
      default: 'RULE_BASED_PRICING',
    },
  },
  {
    timestamps: true,
  }
);

export const Pricing = mongoose.model('Pricing', pricingSchema);
export default Pricing;
