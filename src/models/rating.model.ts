import { Schema, model } from 'mongoose';

interface IRating {
  productOwner: string;
  totalPoints: number;
  successfulReturns: number;
  totalPools: number;
  averageReturnTime: number;
  updatedAt: Date;
}

const ratingSchema = new Schema<IRating>(
  {
    productOwner: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    successfulReturns: {
      type: Number,
      default: 0,
    },
    totalPools: {
      type: Number,
      default: 0,
    },
    averageReturnTime: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Rating = model<IRating>('Rating', ratingSchema);
export type RatingDocument = ReturnType<typeof Rating.prototype.toObject>;
