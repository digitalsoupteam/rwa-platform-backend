import { BaseAPIClient } from '@rwa-platform/shared/src/utils/base-api-client';
import { connect } from 'amqplib';
import Queue from 'bull';

interface KYCStatus {
  userId: string;
  status: string;
  provider: string;
  verificationId?: string;
  verificationData?: any;
  lastVerified?: string;
  expiresAt?: string;
}

interface KYCInitiationResponse {
  status: string;
  verificationId: string;
}

export class KYCAPI extends BaseAPIClient {
  private channel: any;
  private notificationQueue!: Queue.Queue;

  constructor() {
    super(process.env.KYC_SERVICE_URL || 'http://kyc:3007', 'kyc');
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

  async getStatus(userId: string): Promise<KYCStatus> {
    return this.fetchJson(`/kyc/status/${userId}`);
  }

  async initiateKYC(userId: string, provider: string, data: any): Promise<KYCInitiationResponse> {
    // Publish request to RabbitMQ
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

    // Create delayed reminder via Bull
    await this.notificationQueue.add(
      'kycReminder',
      { userId },
      {
        delay: 24 * 60 * 60 * 1000, // 24 hours
      }
    );

    // Return initial status
    return {
      status: 'PENDING',
      verificationId: 'pending', // Real ID will come via webhook
    };
  }
}
