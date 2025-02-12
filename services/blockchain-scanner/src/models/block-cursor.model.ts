import mongoose from 'mongoose';

const blockCursorSchema = new mongoose.Schema({
  networkId: { type: String, required: true },
  lastBlockNumber: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const BlockCursor = mongoose.model('BlockCursor', blockCursorSchema);