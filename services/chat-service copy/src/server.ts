import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import { logger } from '@rwa-platform/shared/src';
import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { QueueService } from './queue.service';
import { ChatService } from './chat.service';
import { AccessService } from './access.service';
import { ChatController } from './controllers/chat.controller';

const startServer = async () => {
  // Инициализация сервисов
  const rabbitmq = new RabbitMQClient({
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchanges: [
      { name: 'chat.events', type: 'topic' }
    ]
  });

  const queueService = new QueueService(rabbitmq);
  await queueService.initialize();

  const chatService = new ChatService();
  const accessService = new AccessService();
  const chatController = new ChatController(chatService, accessService);

  const app = new Elysia()
    .use(cors())
    .use(swagger())

    .get('/', () => ({
      message: 'Welcome to chat-service',
      version: '1.0.0',
    }))

    .get('/health', () => ({
      status: 'ok',
      service: 'chat-service',
      timestamp: new Date().toISOString(),
    }))

    .get('/metrics', () => ({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    }))

    // Маршруты для пользователей (через gateway)
    .get('/chats', ({ request }) => chatController.getUserChats(request))
    .get('/chats/:chatId/messages', ({ request }) => chatController.getMessages(request))
    .post('/chats/:chatId/messages', ({ request }) => chatController.sendMessage(request))

    .listen({
      hostname: '0.0.0.0',
      port: 3008,
    });

  console.log(`🚀 chat-service is running at ${app.server?.hostname}:${app.server?.port}`);

  // MongoDB connection
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform');
  logger.info('📦 MongoDB connected');

  return app;
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Starting graceful shutdown...');
  // Здесь можно добавить закрытие соединений
  process.exit(0);
});

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});