import { ParticipantRole } from "./room.types";

export interface Message {
    id: string;
    roomId: string;
    sender: {
      address: string;
      role: ParticipantRole;
    };
    content: string;
    metadata?: Record<string, any>;
    createdAt: Date;
  }