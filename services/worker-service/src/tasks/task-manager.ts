import Bull from 'bull';
import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger } from '@rwa-platform/shared/src';
import { TaskConfig } from '../types';


export class TaskManager {
  private queues: Map<string, Bull.Queue>;

  constructor(
    private rabbitmq: RabbitMQClient,
    private tasks: TaskConfig[],
    private redisConfig: any
  ) {
    this.queues = new Map();
  }

  async initialize() {
    // Initialize Bull queues
    for (const task of this.tasks) {
      const queue = new Bull(task.queue, {
        redis: this.redisConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      });

      // Setup Bull processor
      queue.process(async (job: any) => {
        const result = await task.handler(job);
        // Send result back via RabbitMQ
        await this.rabbitmq.publish(task.responseQueue, {
          jobId: job.id,
          result
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
