import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Token family for rotation detection
    // All tokens in a refresh chain share the same family ID
    family: {
      type: String,
      required: true,
      index: true,
    },
    // Device/client fingerprint for tracking sessions
    deviceInfo: {
      userAgent: { type: String, default: '' },
      ip: { type: String, default: '' },
      deviceName: { type: String, default: '' },
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    // Revocation tracking
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedReason: {
      type: String,
      enum: ['LOGOUT', 'TOKEN_REUSE_DETECTED', 'PASSWORD_CHANGED', 'MANUAL_REVOCATION', 'EXPIRED'],
      default: null,
    },
    // Last time this token was used to refresh
    lastUsedAt: {
      type: Date,
      default: null,
    },
    // Successor token (when rotated)
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RefreshToken',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient cleanup of expired/revoked tokens
refreshTokenSchema.index({ expiresAt: 1, isRevoked: 1 });
refreshTokenSchema.index({ user: 1, isRevoked: 1 });

// Static method: Clean up expired tokens
refreshTokenSchema.statics.cleanupExpired = async function () {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
};

// Static method: Revoke all tokens for a user
refreshTokenSchema.statics.revokeAllForUser = async function (userId, reason = 'MANUAL_REVOCATION') {
  const result = await this.updateMany(
    { user: userId, isRevoked: false },
    {
      $set: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    }
  );
  return result.modifiedCount;
};

// Static method: Revoke entire token family (for token reuse detection)
refreshTokenSchema.statics.revokeFamilyByToken = async function (tokenString) {
  const token = await this.findOne({ token: tokenString });
  if (!token) {
    return 0;
  }
  
  const result = await this.updateMany(
    { family: token.family, isRevoked: false },
    {
      $set: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'TOKEN_REUSE_DETECTED',
      },
    }
  );
  return result.modifiedCount;
};

// Instance method: Check if token is valid (not expired, not revoked)
refreshTokenSchema.methods.isValid = function () {
  if (this.isRevoked) {
    return false;
  }
  if (this.expiresAt < new Date()) {
    return false;
  }
  return true;
};

// Instance method: Revoke this token
refreshTokenSchema.methods.revoke = async function (reason = 'MANUAL_REVOCATION') {
  this.isRevoked = true;
  this.revokedAt = new Date();
  this.revokedReason = reason;
  await this.save();
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
