import { logger, metrics } from '@rwa-platform/shared/src';
import { connect } from 'amqplib';
import Queue from 'bull';

export class KYCAPI {
  private baseURL: string;
  private channel: any;
  private notificationQueue!: Queue.Queue;

  constructor() {
    this.baseURL = process.env.KYC_SERVICE_URL || 'http://kyc:3007';
    this.initializeQueues();
  }

  private async initializeQueues() {
    // RabbitMQ setup
    const connection = await connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    this.channel = await connection.createChannel();
    await this.channel.assertQueue('kyc_updates');

    // Bull queue for notifications
    this.notificationQueue = new Queue('kyc_notifications', process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async getStatus(userId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/kyc/status/${userId}`);
      const data = await response.json();

      metrics.increment('gateway.kyc.status.success');
      return data;
    } catch (error: any) {
      logger.error(`Failed to get KYC status: ${error.message}`);
      metrics.increment('gateway.kyc.status.error');
      throw error;
    }
  }

  async initiateKYC(userId: string, provider: string, data: any): Promise<any> {
    try {
      // Публикуем запрос в RabbitMQ
      await this.channel.sendToQueue(
        'kyc_requests',
        Buffer.from(
          JSON.stringify({
            userId,
            provider,
            data,
            timestamp: new Date().toISOString(),
          })
        )
      );

      // Создаем отложенное напоминание через Bull
      await this.notificationQueue.add(
        'kycReminder',
        { userId },
        {
          delay: 24 * 60 * 60 * 1000, // 24 часа
        }
      );

      metrics.increment('gateway.kyc.initiation.success');

      // Возвращаем начальный статус
      return {
        status: 'PENDING',
        verificationId: 'pending', // Реальный ID придет через webhook
      };
    } catch (error: any) {
      logger.error(`Failed to initiate KYC: ${error.message}`);
      metrics.increment('gateway.kyc.initiation.error');
      throw error;
    }
  }
}
