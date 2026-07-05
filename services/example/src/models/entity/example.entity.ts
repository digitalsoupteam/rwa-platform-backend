import mongoose, { Schema } from 'mongoose';
import type { InferRawDocType } from 'mongoose';

const exampleSchemaDefinition = {
  name: { type: String, required: true, trim: true },
  ownerId: { type: String, required: true, trim: true },
  ownerType: { type: String, required: true, trim: true },
  creator: { type: String, required: true, trim: true },
  parentId: { type: String, required: true, trim: true },
  grandParentId: { type: String, required: true, trim: true },
  createdAt: { type: Number, default: Math.floor(Date.now() / 1000) },
  updatedAt: { type: Number, default: Math.floor(Date.now() / 1000) },
} as const;

const exampleSchema = new Schema(exampleSchemaDefinition, {
  timestamps: { currentTime: () => Math.floor(Date.now() / 1000) },
});

exampleSchema.index({ ownerId: 1 });
exampleSchema.index({ creator: 1 });

export type IExampleEntity = InferRawDocType<typeof exampleSchemaDefinition> & {
  _id: mongoose.Types.ObjectId;
};

export const ExampleEntity = mongoose.model('Example', exampleSchema);
