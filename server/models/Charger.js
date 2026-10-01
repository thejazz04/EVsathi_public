import mongoose from 'mongoose';

const chargerSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Charger title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    images: [{ type: String }],
    location: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, default: 'India' },
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    chargerType: {
      type: String,
      default: 'Level 2',
    },
    connectorType: {
      type: String,
      default: 'Type 2',
    },
    powerOutput: {
      type: Number, // kW
      required: true,
    },
    isFastCharger: {
      type: Boolean,
      default: false,
    },
    pricePerHour: {
      type: Number,
      required: true,
    },
    pricePerKwh: {
      type: Number,
      default: null,
    },
    hostType: {
      type: String,
      enum: ['Home P2P Host', 'Business Host'],
      default: 'Home P2P Host',
    },
    amenities: [{ type: String }],
    smartScore: {
      type: Number,
      default: 85,
      min: 0,
      max: 100,
    },
    rating: {
      type: Number,
      default: 4.5,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    currentUtilization: {
      type: Number,
      default: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    availabilitySchedule: [
      {
        dayOfWeek: {
          type: Number, // 0 (Sun) to 6 (Sat)
          required: true,
        },
        startHour: { type: Number, default: 0 },
        endHour: { type: Number, default: 24 },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// GeoJSON 2DSphere Geospatial Index for Fast Nearby Searching
chargerSchema.index({ 'location.coordinates': '2dsphere' });
chargerSchema.index({ isAvailable: 1, isActive: 1 });
chargerSchema.index({ pricePerHour: 1, powerOutput: 1 });

export const Charger = mongoose.model('Charger', chargerSchema);
export default Charger;
