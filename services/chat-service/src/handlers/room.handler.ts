import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger, metrics } from '@rwa-platform/shared/src';
import { Room } from '../models/room.model';
import { CreateRoomCommand } from '../types/queue.types';

export class RoomHandler {
  constructor(private rabbitmq: RabbitMQClient) {}

  async initialize() {
    await this.rabbitmq.subscribe('chat.room.create', async (data: CreateRoomCommand) => {
      try {
        const room = await Room.create({
          type: data.type,
          productId: data.productId,
          participants: data.participants,
          metadata: data.metadata
        });

        logger.info(`Room created: ${room.id}`);
        metrics.increment('chat.room.created');

        // Notify about room creation
        await this.rabbitmq.publish('chat.events', {
          type: 'ROOM_CREATED',
          roomId: room.id,
          timestamp: new Date()
        });

      } catch (error: any) {
        logger.error(`Failed to create room: ${error.message}`);
        metrics.increment('chat.room.create.error');
        throw error;
      }
    });
  }
}