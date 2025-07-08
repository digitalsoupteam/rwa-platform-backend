import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const referralSchemaDefinition = {
  userWallet: {
    type: String,
    required: true,
    trim: true,
  },
  referrerWallet: {
    type: String,
    required: true,
    trim: true,
  },
  
  // Timestamps
  createdAt: {
    type: Number,
    default: Math.floor(Date.now() / 1000)
  },
  updatedAt: {
    type: Number,
    default: Math.floor(Date.now() / 1000)
  },
} as const;

const referralSchema = new Schema(referralSchemaDefinition, {
  timestamps: { currentTime: () => Math.floor(Date.now() / 1000) },
});

// Indexes for efficient queries
referralSchema.index({ userWallet: 1 }, { unique: true });
referralSchema.index({ referrerWallet: 1 });
referralSchema.index({ createdAt: -1 });

export type IReferralEntity = InferRawDocType<
  typeof referralSchemaDefinition
> & { _id: Types.ObjectId };

export const ReferralEntity = mongoose.model(
  "Referral",
  referralSchema
);