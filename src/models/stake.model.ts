import { Schema, model } from 'mongoose';

interface IStake {
  user: string;
  type: 'dao' | 'platform';
  amount: number;
  lockedUntil: Date;
  shares?: number;
  createdAt: Date;
  updatedAt: Date;
}

const stakeSchema = new Schema<IStake>(
  {
    user: {
      type: String,
      required: true,
      lowercase: true,
    },
    type: {
      type: String,
      enum: ['dao', 'platform'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    lockedUntil: {
      type: Date,
      required: true,
    },
    shares: Number,
  },
  { timestamps: true }
);

export const Stake = model<IStake>('Stake', stakeSchema);
export type StakeDocument = ReturnType<typeof Stake.prototype.toObject>;
