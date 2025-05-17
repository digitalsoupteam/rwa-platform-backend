import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const businessSchemaDefinition = {
  ownerId: {
    type: String,
    required: true,
    trim: true,
  },
  ownerType: {
    type: String,
    required: true,
    trim: true,
  },
  ownerWallet: {
    type: String,
    trim: true,
  },
  chainId: {
    type: String,
    required: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  tokenAddress: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  tags: {
    type: [String],
    default: []
  },
  riskScore: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  image: {
    type: String,
    trim: true,
  },
  approvalSignaturesTaskId: {
    type: String,
  },
  approvalSignaturesTaskExpired: {
      type: Number,
  },
  paused: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Number,
    default: Math.floor(Date.now() / 1000)
  },
  updatedAt: {
    type: Number,
    default: Math.floor(Date.now() / 1000)
  },
} as const;

const businessSchema = new Schema(businessSchemaDefinition, {
  timestamps: { currentTime: () => Math.floor(Date.now() / 1000) },
});

businessSchema.index({ ownerId: 1 });
businessSchema.index({ tags: 1 });
businessSchema.index({ riskScore: 1 });
businessSchema.index({ createdAt: -1 });
businessSchema.index({ tags: 1, riskScore: 1 });

export type IBusinessEntity = InferRawDocType<
  typeof businessSchemaDefinition
> & { _id: Types.ObjectId };

export const BusinessEntity = mongoose.model(
  "Business",
  businessSchema
);