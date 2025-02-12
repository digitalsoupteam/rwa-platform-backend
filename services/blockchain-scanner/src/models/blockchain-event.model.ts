import mongoose from 'mongoose';

const blockchainEventSchema = new mongoose.Schema({
  networkId: { type: String, required: true },
  contractAddress: { type: String, required: true },
  eventName: { type: String, required: true },
  blockNumber: { type: Number, required: true },
  transactionHash: { type: String, required: true },
  timestamp: { type: Date, required: true },
  returnValues: { type: mongoose.Schema.Types.Mixed },
  raw: { type: mongoose.Schema.Types.Mixed },
});

export const BlockchainEvent = mongoose.model('BlockchainEvent', blockchainEventSchema);