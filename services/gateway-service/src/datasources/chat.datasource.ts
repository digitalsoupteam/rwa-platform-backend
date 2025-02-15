import { logger, metrics } from '@rwa-platform/shared/src';
import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';

export class ChatDataSource {
  private baseURL: string;
  private rabbitmq: RabbitMQClient;

  constructor() {
    this.baseURL = process.env.CHAT_SERVICE_URL || 'http://chat:3000';
    this.rabbitmq = new RabbitMQClient({
      url: process.env.RABBITMQ_URL || 'amqp://localhost'
    });
  }

  async initialize() {
    await this.rabbitmq.connect();
  }

  private async fetchJson(path: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getRooms(participantAddress: string) {
    try {
      return await this.fetchJson(`/rooms?participant=${participantAddress}`);
    } catch (error: any) {
      logger.error(`Failed to get rooms: ${error.message}`);
      metrics.increment('gateway.chat.rooms.error');
      throw error;
    }
  }

  async getRoom(roomId: string) {
    try {
      return await this.fetchJson(`/rooms/${roomId}`);
    } catch (error: any) {
      logger.error(`Failed to get room: ${error.message}`);
      metrics.increment('gateway.chat.room.error');
      throw error;
    }
  }

  async getMessages(roomId: string, params: { limit?: number, before?: string } = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.before) query.set('before', params.before);

    try {
      return await this.fetchJson(`/rooms/${roomId}/messages?${query}`);
    } catch (error: any) {
      logger.error(`Failed to get messages: ${error.message}`);
      metrics.increment('gateway.chat.messages.error');
      throw error;
    }
  }

  async sendMessage(roomId: string, sender: string, content: string) {
    try {
      await this.rabbitmq.publish('chat.message.send', {
        roomId,
        sender,
        content,
        timestamp: new Date()
      });
      metrics.increment('gateway.chat.message.sent');
    } catch (error: any) {
      logger.error(`Failed to send message: ${error.message}`);
      metrics.increment('gateway.chat.message.error');
      throw error;
    }
  }
}