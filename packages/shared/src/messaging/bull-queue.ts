import Bull, { Queue, Job, JobOptions } from 'bull';
import { logger } from '../utils/structured-logger';
import { metrics } from '../utils/monitoring';

export interface BullQueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  name: string;
  defaultJobOptions?: JobOptions;
}

export class BullQueue<DataType = any> {
  private queue: Queue<DataType>;
  private readonly name: string;

  constructor(config: BullQueueConfig) {
    this.name = config.name;
    this.queue = new Bull(config.name, {
      redis: config.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100, // Хранить последние 100 выполненных задач
        removeOnFail: 100, // Хранить последние 100 проваленных задач
        ...config.defaultJobOptions,
      },
    });

    this.setupMetrics();
    this.setupListeners();

    logger.info('Bull queue initialized', { queue: this.name });
  }

  private setupMetrics(): void {
    // Основные метрики
    metrics.gauge(`bull_queue_size{queue="${this.name}"}`, 0);
    metrics.gauge(`bull_active_jobs{queue="${this.name}"}`, 0);
    metrics.gauge(`bull_completed_jobs{queue="${this.name}"}`, 0);
    metrics.gauge(`bull_failed_jobs{queue="${this.name}"}`, 0);
    metrics.gauge(`bull_delayed_jobs{queue="${this.name}"}`, 0);
    metrics.gauge(`bull_waiting_jobs{queue="${this.name}"}`, 0);

    // Обновление метрик каждые 5 секунд
    setInterval(async () => {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          this.queue.getWaitingCount(),
          this.queue.getActiveCount(),
          this.queue.getCompletedCount(),
          this.queue.getFailedCount(),
          this.queue.getDelayedCount(),
        ]);

        metrics.gauge(`bull_queue_size{queue="${this.name}"}`, waiting + active + delayed);
        metrics.gauge(`bull_active_jobs{queue="${this.name}"}`, active);
        metrics.gauge(`bull_completed_jobs{queue="${this.name}"}`, completed);
        metrics.gauge(`bull_failed_jobs{queue="${this.name}"}`, failed);
        metrics.gauge(`bull_delayed_jobs{queue="${this.name}"}`, delayed);
        metrics.gauge(`bull_waiting_jobs{queue="${this.name}"}`, waiting);
      } catch (error) {
        logger.error('Failed to update Bull metrics', { error, queue: this.name });
      }
    }, 5000);
  }

  private setupListeners(): void {
    this.queue.on('error', (error) => {
      logger.error('Bull queue error', { error, queue: this.name });
      metrics.increment(`bull_errors{queue="${this.name}"}`);
    });

    this.queue.on('failed', (job, error) => {
      logger.error('Job failed', {
        error,
        queue: this.name,
        jobId: job.id,
        attempts: job.attemptsMade,
      });
      metrics.increment(`bull_job_failures{queue="${this.name}"}`);
    });

    this.queue.on('completed', (job) => {
      const duration = Date.now() - job.timestamp;
      metrics.gauge(`bull_job_duration{queue="${this.name}"}`, duration);
      metrics.increment(`bull_job_completions{queue="${this.name}"}`);

      logger.debug('Job completed', {
        queue: this.name,
        jobId: job.id,
        duration,
      });
    });
  }

  async add(
    data: DataType,
    options: {
      delay?: number;
      priority?: number;
      attempts?: number;
      repeat?: {
        cron: string;
        tz?: string;
        endDate?: Date | string | number;
      };
    } = {}
  ): Promise<Job<DataType>> {
    try {
      const job = await this.queue.add(data, {
        ...options,
        jobId: options.repeat ? undefined : Math.random().toString(36).substring(7),
      });

      logger.debug('Job added to queue', {
        queue: this.name,
        jobId: job.id,
        delay: options.delay,
        priority: options.priority,
        repeat: options.repeat,
      });

      metrics.increment(`bull_jobs_added{queue="${this.name}"}`);

      return job;
    } catch (error) {
      logger.error('Failed to add job to queue', {
        error,
        queue: this.name,
        data,
        options,
      });
      throw error;
    }
  }

  async process(
    processor: (job: Job<DataType>) => Promise<void>,
    concurrency: number = 1
  ): Promise<void> {
    try {
      this.queue.process(concurrency, async (job) => {
        const startTime = Date.now();
        logger.debug('Processing job', {
          queue: this.name,
          jobId: job.id,
          attempt: job.attemptsMade + 1,
        });

        try {
          await processor(job);

          const duration = Date.now() - startTime;
          metrics.gauge(`bull_processing_time{queue="${this.name}"}`, duration);

          logger.debug('Job processed successfully', {
            queue: this.name,
            jobId: job.id,
            duration,
          });
        } catch (error) {
          metrics.increment(`bull_processing_errors{queue="${this.name}"}`);
          logger.error('Error processing job', {
            error,
            queue: this.name,
            jobId: job.id,
            attempt: job.attemptsMade + 1,
          });
          throw error; // Пробрасываем ошибку для ретрая
        }
      });

      logger.info('Job processor registered', {
        queue: this.name,
        concurrency,
      });
    } catch (error) {
      logger.error('Failed to register job processor', {
        error,
        queue: this.name,
      });
      throw error;
    }
  }

  async addCron(
    data: DataType,
    cronExpression: string,
    options: {
      timezone?: string;
      endDate?: Date;
    } = {}
  ): Promise<Job<DataType>> {
    return this.add(data, {
      repeat: {
        cron: cronExpression,
        tz: options.timezone,
        endDate: options.endDate,
      },
    });
  }

  async removeCron(jobId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
        logger.info('Cron job removed', {
          queue: this.name,
          jobId,
        });
      }
    } catch (error) {
      logger.error('Failed to remove cron job', {
        error,
        queue: this.name,
        jobId,
      });
      throw error;
    }
  }

  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info('Queue paused', { queue: this.name });
  }

  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info('Queue resumed', { queue: this.name });
  }

  async close(): Promise<void> {
    await this.queue.close();
    logger.info('Queue closed', { queue: this.name });
  }

  async clean(grace: number): Promise<number> {
    const jobs = await this.queue.clean(grace);
    const total = jobs.length;
    logger.info('Queue cleaned', {
      queue: this.name,
      removedJobs: total,
    });
    return total;
  }

  getQueue(): Queue<DataType> {
    return this.queue;
  }
}
