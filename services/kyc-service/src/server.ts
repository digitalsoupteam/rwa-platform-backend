import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import { VerificationOrchestrator } from './domain/verification.orchestrator';
import { SumsubProvider } from './providers/sumsub.provider';
import { ShuftiProProvider } from './providers/shuftipro.provider';
import { connect } from 'amqplib';
import Queue from 'bull';
import { logger, metrics, CircuitBreaker, jwtService } from '@rwa-platform/shared/src';

const verificationOrchestrator = new VerificationOrchestrator();

// Register providers
verificationOrchestrator.registerProvider(
  new SumsubProvider(process.env.SUMSUB_API_KEY!, process.env.SUMSUB_API_SECRET!)
);
verificationOrchestrator.registerProvider(
  new ShuftiProProvider(process.env.SHUFTIPRO_CLIENT_ID!, process.env.SHUFTIPRO_SECRET_KEY!)
);

// RabbitMQ Consumer
async function setupQueues() {
  const connection = await connect(process.env.RABBITMQ_URL || 'amqp://localhost');
  const channel = await connection.createChannel();

  // Очередь для запросов на KYC
  await channel.assertQueue('kyc_requests');
  channel.consume('kyc_requests', async (msg: any) => {
    if (msg) {
      const { userId, provider, data } = JSON.parse(msg.content.toString());
      try {
        await verificationOrchestrator.initiateVerification(userId, provider, data);
        channel.ack(msg);
      } catch (error: any) {
        logger.error(`Failed to process KYC request: ${error.message}`);
        // Решаем, нужно ли переотправить сообщение
        channel.nack(msg);
      }
    }
  });

  // Bull queue для уведомлений
  const notificationQueue = new Queue('kyc_notifications', process.env.REDIS_URL);
  notificationQueue.process('kycReminder', async (job: any) => {
    const { userId } = job.data;
    const status = await verificationOrchestrator.checkVerificationStatus(userId);

    if (status.status === 'pending') {
      // Отправить напоминание через notification-service
      await fetch(`${process.env.NOTIFICATION_SERVICE_URL}/notify`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          type: 'KYC_REMINDER',
          message: 'Please complete your KYC verification',
        }),
      });
    }
  });
}

setupQueues().catch(console.error);

const app = new Elysia()
  .use(cors())
  .use(swagger())

  .get('/', () => ({
    message: 'Welcome to kyc-service',
    version: '1.0.0',
  }))
  .get('/health', () => ({
    status: 'ok',
    service: 'kyc-service',
    timestamp: new Date().toISOString(),
  }))

  .get('/metrics', () => ({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  }))

  .post('/kyc/initiate', async ({ body }) => {
    const { userId, provider, data } = body as any;
    return await verificationOrchestrator.initiateVerification(userId, provider, data);
  })

  .get('/kyc/status/:userId', async ({ params }) => {
    return await verificationOrchestrator.checkVerificationStatus(params.userId);
  })

  .post('/kyc/webhook/:provider', async ({ params, body }: any) => {
    await verificationOrchestrator.handleWebhook(params.provider, body);

    // Отправляем обновление статуса через RabbitMQ
    const channel = await (await connect(process.env.RABBITMQ_URL)).createChannel();
    await channel.assertQueue('kyc_updates');
    await channel.sendToQueue(
      'kyc_updates',
      Buffer.from(
        JSON.stringify({
          userId: body.userId,
          status: body.status,
          timestamp: new Date().toISOString(),
        })
      )
    );

    return { success: true };
  })

  .listen(3007);

console.log(`🚀 kyc-service is running at ${app.server?.hostname}:${app.server?.port}`);

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform')
  .then(() => console.log('📦 MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));
