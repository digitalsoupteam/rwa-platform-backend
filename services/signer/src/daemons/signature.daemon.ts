import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { ReliableConsumer, done, type ConsumeOutcome } from '@shared/rabbitmq/src/reliableConsumer';
import { hasErrorCode } from '@shared/rabbitmq/src/reliability';
import { SignatureService } from '../services/signature.service';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { AppError } from '@shared/errors/app-errors';
import type { ConsumeMessage } from 'amqplib';

/**
 * Daemon for handling signature requests
 */

export class SignatureDaemon {
  private isRunning: boolean = false;
  private readonly reliableConsumer: ReliableConsumer;

  constructor(
    rabbitMQClient: RabbitMQClient,
    requestsQueue: string,
    private readonly signatureService: SignatureService,
  ) {
    this.reliableConsumer = new ReliableConsumer(rabbitMQClient, requestsQueue, {
      // One immediate redelivery; invalid, expired and twice-failed requests
      // are dropped — they can never succeed.
      retry: { mode: 'immediate-once' },
      exhausted: 'drop',
      isPermanent: (error) => hasErrorCode(error, 'VALIDATION_ERROR') || hasErrorCode(error, 'EXPIRED'),
      metricNames: {
        retried: 'signature_request_retried_total',
        dropped: 'signature_request_dropped_total',
      },
    });
  }

  /**
   * Initialize daemon
   */
  @TraceDecorator()
  async initialize(): Promise<void> {
    await this.reliableConsumer.consume((message) => this.handleSignatureRequest(message));
  }

  /**
   * Handle signature request
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ hash: a[0].hash, taskId: a[0].taskId }),
  })
  private async handleSignatureRequest(message: ConsumeMessage): Promise<ConsumeOutcome | void> {
    const request = JSON.parse(message.content.toString());

    // Validate request
    if (!request.hash || !request.taskId || !request.expired) {
      throw new AppError({
        message: 'Invalid signature request format: missing required fields',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate hash format
    if (!/^0x[0-9a-f]{64}$/i.test(request.hash)) {
      throw new AppError({
        message: 'Invalid hash format: must be 32-byte hex string with 0x prefix',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    // Process signature request
    await this.signatureService.signHash(request.hash, request.taskId, request.expired);

    return done;
  }

  /**
   * Start daemon
   */
  @TraceDecorator()
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
  }

  /**
   * Stop daemon
   */
  @TraceDecorator()
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
  }
}
