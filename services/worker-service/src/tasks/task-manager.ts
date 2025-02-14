import Bull from 'bull';
import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger } from '@rwa-platform/shared/src';
import { TaskConfig } from '../types';

export class TaskManager {
  private queues: Map<string, Bull.Queue>;

  constructor(
    private rabbitmq: RabbitMQClient,
    private tasks: TaskConfig[],
    private redisConfig: { url: string }
  ) {
    this.queues = new Map();
  }

  async initialize() {
    // Initialize Bull queues
    for (const task of this.tasks) {
      const queue = new Bull(task.queue, {
        redis: this.redisConfig.url,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      });

      // await this.addDemoJobs(queue, task)

      // Setup Bull processor
      queue.process(async (job: any) => {
        const result = await task.handler(job);
        // Send result back via RabbitMQ
        await this.rabbitmq.publish(task.responseQueue, {
          jobId: job.id,
          result,
        });
        return result;
      });

      this.queues.set(task.queue, queue);
    }

    // Setup RabbitMQ consumers
    for (const task of this.tasks) {
      await this.rabbitmq.setupQueue(task.queue);
      await this.rabbitmq.setupQueue(task.responseQueue);

      await this.rabbitmq.subscribe(task.queue, async (message) => {
        const queue = this.queues.get(task.queue);
        if (!queue) {
          throw new Error(`Queue ${task.queue} not found`);
        }

        await queue.add(task.name, message);
        logger.info(`Added job to queue ${task.queue}`);
      });
    }
  }

  // private async addDemoJobs(queue: Bull.Queue, task: TaskConfig) {
  //   // Очищаем очередь перед добавлением демо-задач
  //   await queue.empty();
  
  //   // Добавляем разные типы демо-задач в зависимости от очереди
  //   switch (task.queue) {
  //     case 'kyc':
  //       await queue.add('demo-kyc', {
  //         userId: 'user123',
  //         documentType: 'passport',
  //         status: 'pending'
  //       });
  //       await queue.add('demo-kyc', {
  //         userId: 'user456',
  //         documentType: 'driver_license',
  //         status: 'pending'
  //       });
  //       break;
  
  //     case 'blockchain':
  //       await queue.add('demo-blockchain', {
  //         transactionHash: '0x123...abc',
  //         blockNumber: 12345678,
  //         event: 'Transfer'
  //       });
  //       await queue.add('demo-blockchain', {
  //         transactionHash: '0x456...def',
  //         blockNumber: 12345679,
  //         event: 'Approval'
  //       });
  //       break;
  
  //     case 'notifications':
  //       await queue.add('demo-notification', {
  //         userId: 'user789',
  //         type: 'email',
  //         template: 'welcome',
  //         data: { name: 'John Doe' }
  //       });
  //       await queue.add('demo-notification', {
  //         userId: 'user012',
  //         type: 'sms',
  //         template: 'verification',
  //         data: { code: '123456' }
  //       });
  //       break;
  //   }
  
  //   // Добавляем задачу с ошибкой для демонстрации обработки ошибок
  //   await queue.add('demo-error', {
  //     error: true,
  //     message: 'This is a demonstration of error handling'
  //   }, {
  //     attempts: 2
  //   });
  // }

  getQueues(): Bull.Queue[] {
    return Array.from(this.queues.values());
  }

  async shutdown() {
    // Close all Bull queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }
}
