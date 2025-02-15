import mongoose from 'mongoose';
import { RoomType, ParticipantRole } from '../types/room.types';

const roomSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(RoomType),
    required: true
  },
  productId: {
    type: String,
    sparse: true
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

roomSchema.index({ type: 1 });
roomSchema.index({}, { sparse: true });
roomSchema.index({ 'participants.address': 1 });

export const Room = mongoose.model('Room', roomSchema);