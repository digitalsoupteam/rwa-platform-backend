import mongoose, { Schema } from 'mongoose';
import type { InferRawDocType } from 'mongoose';

const sampleSchemaDefinition = {
  name: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Number,
    default: Math.floor(Date.now() / 1000),
  },
  updatedAt: {
    type: Number,
    default: Math.floor(Date.now() / 1000),
  },
} as const;

const sampleSchema = new Schema(sampleSchemaDefinition, {
  timestamps: { currentTime: () => Math.floor(Date.now() / 1000) },
});

export type ISampleEntity = InferRawDocType<typeof sampleSchemaDefinition>;
export const SampleEntity = mongoose.model('Sample', sampleSchema);
