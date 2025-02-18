import OpenAI from 'openai';
import { logger } from '@rwa-platform/shared/src';
import { metrics } from '@rwa-platform/shared/src/utils/monitoring';
import { AIConfig, ProcessMessageRequest } from '../types/chat.types';
import { Chat } from '../models/chat.model';

export class AIHandler {
  private openai: OpenAI;
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async processMessage(request: ProcessMessageRequest): Promise<string> {
    const { roomId, message, metadata = {} } = request;
    
    try {
      // Find or create chat history
      let chat = await Chat.findOne({ roomId });
      if (!chat) {
        chat = await Chat.create({
          roomId,
          messages: [],
          metadata: {
            model: metadata.model || this.config.defaultModel,
            temperature: metadata.temperature || this.config.defaultTemperature,
            maxTokens: metadata.maxTokens || this.config.defaultMaxTokens,
          },
        });
      }

      // Add user message to history
      chat.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date(),
      });

      // Prepare messages for AI
      const messages = chat.messages.map(({ role, content }) => ({
        role,
        content,
      }));

      // Get AI response
      const completion = await this.openai.chat.completions.create({
        model: chat.metadata.model,
        messages,
        temperature: chat.metadata.temperature,
        max_tokens: chat.metadata.maxTokens,
      });

      const aiResponse = completion.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('No response from AI');
      }

      // Add AI response to history
      chat.messages.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      });

      await chat.save();
      
      metrics.increment('ai.message.processed');
      logger.info(`AI response generated for room ${roomId}`);

      return aiResponse;

    } catch (error: any) {
      metrics.increment('ai.message.error');
      logger.error(`AI processing error: ${error.message}`);
      throw error;
    }
  }

  async getChatHistory(roomId: string) {
    return Chat.findOne({ roomId });
  }

  async clearChatHistory(roomId: string) {
    return Chat.deleteOne({ roomId });
  }
}
