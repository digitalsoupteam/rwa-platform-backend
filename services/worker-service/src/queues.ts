import path from 'path';
import Queue from 'bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ElysiaAdapter } from '@bull-board/elysia';
import { logger } from '@rwa-platform/shared/src';

const redisOptions = {
  port: 6379,
  host: process.env.REDIS_HOST || 'localhost',
  password: process.env.REDIS_PASSWORD || '',
};

export const createQueue = (name: string) => {
  return new Queue(name, {
    redis: redisOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    }
  });
};

// Initialize queues
export const kycQueue = createQueue('kyc-tasks');
export const blockchainQueue = createQueue('blockchain-events');
export const notificationQueue = createQueue('notifications');

// Setup processors
kycQueue.process(async (job) => {
  logger.info(`Processing KYC task: ${job.id}`);
  // KYC processing logic
  return { status: 'completed' };
});

blockchainQueue.process(async (job) => {
  logger.info(`Processing blockchain event: ${job.id}`);
  // Blockchain event processing logic
  return { status: 'completed' };
});

notificationQueue.process(async (job) => {
  logger.info(`Sending notification: ${job.id}`);
  // Notification sending logic
  return { status: 'sent' };
});

// Setup Bull Board
const serverAdapter = new ElysiaAdapter('/admin/queues');

createBullBoard({
  queues: [
    new BullAdapter(kycQueue),
    new BullAdapter(blockchainQueue),
    new BullAdapter(notificationQueue)
  ],
  serverAdapter,
  options: {
    uiConfig: {},
    uiBasePath: path.resolve(__dirname, '../../../node_modules/@bull-board/ui')
  }
});

export { serverAdapter };