import mongoose from 'mongoose';
import { AIChat, AIMessage } from '../types/chat.types';

const messageSchema = new mongoose.Schema<AIMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema<AIChat>(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    messages: [messageSchema],
    metadata: {
      model: {
        type: String,
        required: true,
      },
      temperature: Number,
      maxTokens: Number,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Chat = mongoose.model<AIChat>('Chat', chatSchema);
