import mongoose from 'mongoose';
import { ChatType, ParticipantRole } from '../types';

const chatSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(ChatType),
    required: true
  },
  productId: {
    type: String,
    sparse: true // Индекс только для непустых значений
  },
  participants: [{
    address: {
      type: String,
      required: true,
      lowercase: true
    },
    role: {
      type: String,
      enum: Object.values(ParticipantRole),
      required: true
    }
  }],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Индексы для быстрого поиска
chatSchema.index({ type: 1 });
chatSchema.index({ productId: 1 }, { sparse: true });
chatSchema.index({ 'participants.address': 1 });

export const Chat = mongoose.model('Chat', chatSchema);