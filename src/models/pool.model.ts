import { Schema, model, Types } from 'mongoose';
import { PoolStatus } from '../types/enums';

interface IPool {
  enterpriseId: Types.ObjectId;
  address?: string;
  targetAmount: number;
  profitPercent: number;
  investmentDuration: number;
  realiseDuration: number;
  documents: {
    businessPlan?: string;
    financialModel?: string;
  };
  riskScore?: number;
  status: PoolStatus;
  ratingScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const poolSchema = new Schema<IPool>(
  {
    enterpriseId: {
      type: Schema.Types.ObjectId,
      ref: 'Enterprise',
      required: true,
    },
    address: {
      type: String,
      lowercase: true,
    },
    targetAmount: {
      type: Number,
      required: true,
      min: 10000,
      max: 150000,
    },
    profitPercent: {
      type: Number,
      required: true,
      min: 4,
      max: 70,
    },
    investmentDuration: {
      type: Number,
      required: true,
      min: 30,
      max: 60,
    },
    realiseDuration: {
      type: Number,
      required: true,
      min: 180,
      max: 1080,
    },
    documents: {
      businessPlan: String,
      financialModel: String,
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: Object.values(PoolStatus),
      default: PoolStatus.PENDING,
    },
    ratingScore: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Pool = model<IPool>('Pool', poolSchema);
export type PoolDocument = ReturnType<typeof Pool.prototype.toObject>;
