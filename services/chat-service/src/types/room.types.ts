export enum RoomType {
    AI_ASSISTANT = 'AI_ASSISTANT',
    PRODUCT_OWNER = 'PRODUCT_OWNER', 
    DAO = 'DAO'
  }
  
  export enum ParticipantRole {
    USER = 'USER',
    AI = 'AI',
    PRODUCT_OWNER = 'PRODUCT_OWNER'
  }
  
  export interface Participant {
    address: string;
    role: ParticipantRole;
  }
  
  export interface Room {
    id: string;
    type: RoomType;
    productId?: string;
    participants: Participant[];
    metadata?: Record<string, any>;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }