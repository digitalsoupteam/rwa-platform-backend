import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const stakingSchemaDefinition = {
  staker: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
  },
  lastStakeTimestamp: {
    type: Number,
    required: true,
  },
  
  chainId: {
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
};

const stakingSchema = new Schema(stakingSchemaDefinition, {
  timestamps: { currentTime: () => Math.floor(Date.now() / 1000) },
});

// Indexes for efficient queries
stakingSchema.index({ staker: 1 });
stakingSchema.index({ chainId: 1 });
stakingSchema.index({ chainId: 1, staker: 1 }, { unique: true });
stakingSchema.index({ createdAt: -1 });

export type IStakingEntity = InferRawDocType<
  typeof stakingSchemaDefinition
> & { _id: Types.ObjectId };

export const StakingEntity = mongoose.model(
  "Staking",
  stakingSchema
);