import { BaseAPIClient } from '@rwa-platform/shared/src/utils/base-api-client';
import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { Room, Message } from '../types/chat.types';

export class ChatDataSource extends BaseAPIClient {
  private rabbitmq: RabbitMQClient;

  constructor() {
    super(process.env.CHAT_SERVICE_URL || 'http://chat:3000', 'chat');
    this.rabbitmq = new RabbitMQClient({
      url: process.env.RABBITMQ_URL || 'amqp://localhost'
    });
  }

  async initialize() {
    await this.rabbitmq.connect();
  }

  async getRooms(participantAddress: string): Promise<Room[]> {
    return this.fetchJson('/rooms', {
      params: { participant: participantAddress }
    });
  }

  async getRoom(roomId: string): Promise<Room> {
    return this.fetchJson(`/rooms/${roomId}`);
  }

  async getMessages(roomId: string, params: { limit?: number, before?: string } = {}): Promise<Message[]> {
    const queryParams: Record<string, string> = {};
    if (params.limit) queryParams.limit = params.limit.toString();
    if (params.before) queryParams.before = params.before;

    return this.fetchJson(`/rooms/${roomId}/messages`, { params: queryParams });
  }

  async sendMessage(roomId: string, sender: string, content: string): Promise<void> {
    await this.rabbitmq.publish('chat.message.send', {
      roomId,
      sender,
      content,
      timestamp: new Date()
    });
  }
}
