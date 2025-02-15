import { RoomType, Participant } from './room.types';

export interface CreateRoomCommand {
  type: RoomType;
  productId?: string;
  participants: Participant[];
  metadata?: Record<string, any>;
}

export interface SendMessageCommand {
  roomId: string;
  sender: string;
  content: string;
  metadata?: Record<string, any>;
}