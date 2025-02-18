import mongoose from 'mongoose';

const blockchainEventSchema = new mongoose.Schema({
  networkId: { type: String, required: true },
  contractAddress: { type: String, required: true, index: true },
  eventName: { type: String, required: true, index: true },
  blockNumber: { type: Number, required: true, index: true },
  blockTimestamp: { type: Number, required: true },
  transactionHash: { type: String, required: true, index: true },
  logIndex: { type: Number, required: true },
  topics: [{ type: String }],
  parsedData: { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps: true,
  indexes: [
    { blockNumber: 1, logIndex: 1 },
    { contractAddress: 1, eventName: 1, blockNumber: -1 }
  ]
});

export const BlockchainEvent = mongoose.model('BlockchainEvent', blockchainEventSchema);
