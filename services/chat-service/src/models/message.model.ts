import mongoose from 'mongoose';
import { ParticipantRole } from '../types/room.types';

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  sender: {
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

messageSchema.index({ roomId: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);