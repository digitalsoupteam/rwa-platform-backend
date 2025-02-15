import { ChatDataSource } from '../datasources/chat.datasource';
import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger, metrics } from '@rwa-platform/shared/src';

interface Context {
  dataSources: {
    chat: ChatDataSource;
  };
  auth: () => Promise<{ address: string }>;
}

export const chatResolver = {
  Query: {
    rooms: async (_: any, __: any, context: Context) => {
      const { address } = await context.auth();
      return context.dataSources.chat.getRooms(address);
    },

    room: async (_: any, { id }: { id: string }, context: Context) => {
      const { address } = await context.auth();
      const room = await context.dataSources.chat.getRoom(id);
      
      if (!room.participants.some((p: any) => p.address === address)) {
        throw new Error('Access denied');
      }
      
      return room;
    },

    messages: async (_: any, 
      { roomId, limit, before }: { roomId: string; limit?: number; before?: string }, 
      context: Context
    ) => {
      const { address } = await context.auth();
      const room = await context.dataSources.chat.getRoom(roomId);
      
      if (!room.participants.some((p: any) => p.address === address)) {
        throw new Error('Access denied');
      }
      
      return context.dataSources.chat.getMessages(roomId, { limit, before });
    }
  },

  Mutation: {
    sendMessage: async (_: any,
      { roomId, content }: { roomId: string; content: string },
      context: Context
    ) => {
      const { address } = await context.auth();
      await context.dataSources.chat.sendMessage(roomId, address, content);
      metrics.increment('gateway.chat.message.sent');
      
      // Return optimistic response
      return {
        id: 'temp-id',
        roomId,
        sender: {
          address,
          role: 'USER'
        },
        content,
        createdAt: new Date().toISOString()
      };
    }
  },

  Subscription: {
    messageReceived: {
      subscribe: async (_: any, { roomId }: { roomId: string }, context: Context) => {
        const { address } = await context.auth();
        const room = await context.dataSources.chat.getRoom(roomId);
        
        if (!room.participants.some((p: any) => p.address === address)) {
          throw new Error('Access denied');
        }

        const rabbitmq = new RabbitMQClient({
          url: process.env.RABBITMQ_URL || 'amqp://localhost'
        });
        await rabbitmq.connect();

        return {
          [Symbol.asyncIterator]: () => {
            return rabbitmq.getChannel()!.consume(`chat.messages.${roomId}`, msg => {
              if (msg) {
                rabbitmq.getChannel()!.ack(msg);
                return JSON.parse(msg.content.toString());
              }
            });
          }
        };
      }
    }
  }
};