export interface Room {
  id: string;
  type: string;
  productId?: string;
  participants: Participant[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  address: string;
  role: string;
}

export interface Message {
  id: string;
  roomId: string;
  sender: Participant;
  content: string;
  metadata?: Record<string, any>;
  createdAt: string;
}
