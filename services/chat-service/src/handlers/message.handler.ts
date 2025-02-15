import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger, metrics } from '@rwa-platform/shared/src';
import { Room } from '../models/room.model';
import { Message } from '../models/message.model';
import { SendMessageCommand } from '../types/queue.types';

export class MessageHandler {
  constructor(private rabbitmq: RabbitMQClient) {}

  async initialize() {
    await this.rabbitmq.subscribe('chat.message.send', async (data: SendMessageCommand) => {
      try {
        // Check room and permissions
        const room = await Room.findById(data.roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        const participant = room.participants.find(p => 
          p.address.toLowerCase() === data.sender.toLowerCase()
        );
        if (!participant) {
          throw new Error('Sender not in room');
        }

        // Create message
        const message = await Message.create({
          roomId: data.roomId,
          sender: {
            address: data.sender,
            role: participant.role
          },
          content: data.content,
          metadata: data.metadata
        });

        logger.info(`Message sent: ${message.id} in room: ${data.roomId}`);
        metrics.increment('chat.message.sent');

        // Notify about new message
        await this.rabbitmq.publish('chat.events', {
          type: 'MESSAGE_SENT',
          roomId: data.roomId,
          messageId: message.id,
          timestamp: new Date()
        });

      } catch (error: any) {
        logger.error(`Failed to send message: ${error.message}`);
        metrics.increment('chat.message.send.error');
        throw error;
      }
    });
  }
}