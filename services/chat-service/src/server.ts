import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import mongoose from 'mongoose';
import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger } from '@rwa-platform/shared/src';
import { Room } from './models/room.model';
import { Message } from './models/message.model';
import { RoomHandler } from './handlers/room.handler';
import { MessageHandler } from './handlers/message.handler';

const startServer = async () => {
  // Initialize RabbitMQ
  const rabbitmq = new RabbitMQClient({
    url: process.env.RABBITMQ_URL || 'amqp://rabbitmq',
    exchanges: [
      { name: 'chat.events', type: 'topic' }
    ]
  });
  await rabbitmq.connect();

  // Initialize handlers
  const roomHandler = new RoomHandler(rabbitmq);
  const messageHandler = new MessageHandler(rabbitmq);
  await Promise.all([
    roomHandler.initialize(),
    messageHandler.initialize()
  ]);

  const app = new Elysia()
    .use(cors())

    .get('/rooms/:id/messages', async ({ params, query }) => {
      const { id } = params;
      const { before, limit = '50' } = query;

      const messages = await Message.find({
        roomId: id,
        ...(before && { createdAt: { $lt: before } })
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

      return messages;
    })

    .get('/rooms/:id', async ({ params }) => {
      const room = await Room.findById(params.id);
      if (!room) throw new Error('Room not found');
      return room;
    })

    .get('/rooms', async ({ query }) => {
      const { participant } = query;
      return Room.find({
        'participants.address': participant,
        isActive: true
      });
    })

    .listen(3000);

  // MongoDB connection
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/chat');
  logger.info('MongoDB connected');

  return app;
};

startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});