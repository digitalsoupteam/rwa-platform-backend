import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const stakingHistorySchemaDefinition = {
  staker: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
  },
  operation: {
    type: String,
    required: true,
    enum: ["staked", "unstaked"],
  },
  
  // Blockchain metadata
  chainId: {
    type: String,
    required: true,
    trim: true,
  },
  transactionHash: {
    type: String,
    required: true,
    trim: true,
  },
  logIndex: {
    type: Number,
    required: true,
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

const stakingHistorySchema = new Schema(stakingHistorySchemaDefinition, {
  timestamps: { currentTime: () => Math.floor(Date.now() / 1000) },
});

// Indexes for efficient queries
stakingHistorySchema.index({ staker: 1 });
stakingHistorySchema.index({ chainId: 1 });
stakingHistorySchema.index({ operation: 1 });
stakingHistorySchema.index({ chainId: 1, staker: 1 });
stakingHistorySchema.index({ transactionHash: 1, logIndex: 1 }, { unique: true });
stakingHistorySchema.index({ createdAt: -1 });

export type IStakingHistoryEntity = InferRawDocType<
  typeof stakingHistorySchemaDefinition
> & { _id: Types.ObjectId };

export const StakingHistoryEntity = mongoose.model(
  "StakingHistory",
  stakingHistorySchema
);