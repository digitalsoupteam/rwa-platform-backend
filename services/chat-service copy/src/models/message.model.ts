
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  sender: {
    address: {
      type: String,
      required: true,
      lowercase: true
    },
    role: {
      type: String,
      required: true
    }
  },
  content: {
    type: String,
    required: true
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

messageSchema.index({ chatId: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);