import { Queue, Worker } from 'bullmq';
import config from '../config/config';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

export const messageQueue = new Queue('message-queue', {
  connection,
});

let worker: Worker | null = null;

export function createWorker() {
  if (!worker) {
    worker = new Worker(
      'message-queue',
      async (job) => {
        console.log('Processing message via BullMQ:', job.data);
        return true;
      },
      { connection }
    );

    worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });
  }
  return worker;
}

export async function closeWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
