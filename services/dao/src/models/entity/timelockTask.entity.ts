import mongoose, { Schema, InferRawDocType, Types } from "mongoose";

const timelockTaskSchemaDefinition = {
  txHash: {
    type: String,
    required: true,
    trim: true,
  },
  target: {
    type: String,
    required: true,
    trim: true,
  },
  data: {
    type: String,
    required: true,
  },
  eta: {
    type: Number,
    required: true,
  },
  executed: {
    type: Boolean,
    default: false
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

const timelockTaskSchema = new Schema(timelockTaskSchemaDefinition, {
  timestamps: { currentTime: () => Math.floor(Date.now() / 1000) },
});

// Indexes for efficient queries
timelockTaskSchema.index({ txHash: 1 }, { unique: true });
timelockTaskSchema.index({ chainId: 1 });
timelockTaskSchema.index({ executed: 1 });
timelockTaskSchema.index({ eta: 1 });
timelockTaskSchema.index({ createdAt: -1 });

export type ITimelockTaskEntity = InferRawDocType<
  typeof timelockTaskSchemaDefinition
> & { _id: Types.ObjectId };

export const TimelockTaskEntity = mongoose.model(
  "TimelockTask",
  timelockTaskSchema
);