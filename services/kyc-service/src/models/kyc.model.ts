import mongoose from 'mongoose';

const kycSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    provider: {
      type: String,
      required: true,
    },
    verificationId: String,
    verificationData: Object,
    attempts: [
      {
        timestamp: Date,
        status: String,
        provider: String,
        details: Object,
      },
    ],
    lastVerified: Date,
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

export const KYC = mongoose.model('KYC', kycSchema);
