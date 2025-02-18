export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AIChat {
  id: string;
  roomId: string;
  messages: AIMessage[];
  metadata: {
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessMessageRequest {
  roomId: string;
  message: string;
  metadata?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface AIConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
}
