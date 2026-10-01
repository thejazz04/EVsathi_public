import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    role: {
      type: String,
      enum: ['driver', 'DRIVER', 'HOST'],
      default: 'driver',
    },
    phone: {
      type: String,
      default: '',
    },
    avatar: {
      type: String,
      default: '',
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    vehicle: {
      make: { type: String, default: '' },
      model: { type: String, default: '' },
      year: { type: Number, default: 2024 },
      licensePlate: { type: String, default: '' },
      batteryCapacityKwh: { type: Number, default: 60 },
      preferredConnector: { type: String, default: 'Type 2' },
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    fcmToken: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Password hashing before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// Compare password helper
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
export default User;
