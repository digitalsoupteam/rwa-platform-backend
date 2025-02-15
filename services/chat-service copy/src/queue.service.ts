import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { CreateChatRequest } from './types';
import { Chat } from './models/chat.model';
import { logger } from '@rwa-platform/shared/src';

export class QueueService {
  constructor(private rabbitmq: RabbitMQClient) {}

  async initialize() {
    await this.rabbitmq.connect();
    await this.setupConsumers();
  }

  private async setupConsumers() {
    // Слушаем команды на создание чатов
    await this.rabbitmq.subscribe('chat.create', async (data: CreateChatRequest) => {
      try {
        const chat = await Chat.create({
          type: data.type,
          productId: data.productId,
          participants: data.participants,
          metadata: data.metadata
        });

        logger.info(`Chat created: ${chat._id}, type: ${chat.type}`);
        
        // Уведомляем о создании чата
        await this.rabbitmq.publish('chat.events', {
          type: 'CHAT_CREATED',
          chatId: chat._id,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        logger.error(`Failed to create chat: ${error.message}`);
        // В случае ошибки, сообщение вернется в очередь
        throw error;
      }
    });
  }
}