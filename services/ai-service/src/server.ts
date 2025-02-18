import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger } from '@rwa-platform/shared/src';
import { metrics } from '@rwa-platform/shared/src/utils/monitoring';
import { AIHandler } from './handlers/ai.handler';
import { ProcessMessageRequest } from './types/chat.types';
import { z } from 'zod';

// Validate request schema
const processMessageSchema = z.object({
  roomId: z.string(),
  message: z.string(),
  metadata: z
    .object({
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(1).max(4000).optional(),
    })
    .optional(),
});

const startServer = async () => {
  // Check required env variables
  if (!process.env.AI_API_KEY) {
    logger.error('AI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Initialize AI handler
  const aiHandler = new AIHandler({
    apiKey: process.env.AI_API_KEY,
    baseUrl: process.env.AI_BASE_URL,
    defaultModel: process.env.DEFAULT_MODEL || 'gpt-3.5-turbo',
    defaultTemperature: Number(process.env.DEFAULT_TEMPERATURE) || 0.7,
    defaultMaxTokens: Number(process.env.DEFAULT_MAX_TOKENS) || 1000,
  });

  // Initialize RabbitMQ
  const rabbitmq = new RabbitMQClient({
    url: process.env.RABBITMQ_URL || 'amqp://rabbitmq',
    exchanges: [
      { name: 'chat.events', type: 'topic' }
    ]
  });
  await rabbitmq.connect();
  logger.info('Connected to RabbitMQ');

  // Subscribe to chat messages that need AI processing
  await rabbitmq.subscribe('chat.message.ai.process', async (data: ProcessMessageRequest) => {
    try {
      const response = await aiHandler.processMessage(data);

      // Send AI response back to chat service
      await rabbitmq.publish('chat.message.send', {
        roomId: data.roomId,
        sender: 'ai-assistant',
        content: response,
        metadata: {
          isAiResponse: true,
        },
      });
    } catch (error: any) {
      logger.error(`Failed to process AI message: ${error.message}`);
      metrics.increment('ai.message.process.error');
    }
  });

  const app = new Elysia()
    .use(cors())
    .use(swagger())
    .onError(({ code, error }) => {
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      logger.error(`Server error: ${errorMessage}`);
      metrics.increment('server.error');
      return new Response(errorMessage, { status: code === 'VALIDATION' ? 400 : 500 });
    })

    // Health check endpoint
    .get('/health', () => ({
      status: 'ok',
      service: 'ai-service',
      timestamp: new Date().toISOString(),
    }))

    // Metrics endpoint
    .get('/metrics', () => ({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    }))

    // Process message endpoint
    .post('/api/chat', async ({ body }) => {
      const validatedBody = processMessageSchema.parse(body);
      const response = await aiHandler.processMessage(validatedBody);
      return { response };
    })

    // Get chat history endpoint
    .get('/api/chat/:roomId', async ({ params: { roomId } }) => {
      const chat = await aiHandler.getChatHistory(roomId);
      if (!chat) {
        return new Response('Chat not found', { status: 404 });
      }
      return chat;
    })

    // Clear chat history endpoint
    .delete('/api/chat/:roomId', async ({ params: { roomId } }) => {
      await aiHandler.clearChatHistory(roomId);
      return { success: true };
    })

    .listen({
      hostname: '0.0.0.0',
      port: Number(process.env.PORT) || 3000,
    });

  // MongoDB connection
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-service');
  logger.info('📦 MongoDB connected');

  return app;
};

// Start server
startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  process.exit(0);
});
