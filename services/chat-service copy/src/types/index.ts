export enum ChatType {
    AI_ASSISTANT = 'AI_ASSISTANT',
    PRODUCT_OWNER = 'PRODUCT_OWNER',
    DAO = 'DAO'
  }
  
  export enum ParticipantRole {
    USER = 'USER',
    AI = 'AI',
    PRODUCT_OWNER = 'PRODUCT_OWNER'
  }
  
  export interface ChatParticipant {
    address: string;
    role: ParticipantRole;
  }
  
  export interface CreateChatRequest {
    type: ChatType;
    productId?: string; // Для PRODUCT_OWNER чатов
    participants: ChatParticipant[];
    metadata?: Record<string, any>;
  }