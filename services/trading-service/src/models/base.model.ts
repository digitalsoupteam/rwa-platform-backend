import mongoose from 'mongoose';

const baseSchema = new mongoose.Schema(
  {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export const BaseModel = mongoose.model('Base', baseSchema);
