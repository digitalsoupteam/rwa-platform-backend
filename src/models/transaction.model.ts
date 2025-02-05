import { Schema, model } from 'mongoose';
import { TransactionType, TransactionStatus } from '../types/enums';

interface ITransaction {
  hash: string;
  type: TransactionType;
  status: TransactionStatus;
  from: string;
  to: string;
  data?: string;
  value?: number;
  gasUsed?: number;
  blockNumber?: number;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    hash: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      required: true,
    },
    from: {
      type: String,
      required: true,
      lowercase: true,
    },
    to: {
      type: String,
      required: true,
      lowercase: true,
    },
    data: String,
    value: Number,
    gasUsed: Number,
    blockNumber: Number,
    timestamp: Date,
  },
  { timestamps: true }
);

export const Transaction = model<ITransaction>('Transaction', transactionSchema);
export type TransactionDocument = ReturnType<typeof Transaction.prototype.toObject>;
