import { SignersManagerClient } from '../clients/signersManager.client';
import { SignatureService } from '../services/signature.service';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { AppError } from '@shared/errors/app-errors';

/**
 * Daemon for handling signature requests
 */

export class SignatureDaemon {
  private isRunning: boolean = false;

  constructor(
    private readonly signersManagerClient: SignersManagerClient,
    private readonly signatureService: SignatureService,
  ) {}

  /**
   * Initialize daemon
   */
  @TraceDecorator()
  async initialize(): Promise<void> {
    try {
      // Start consuming signature requests
      await this.signersManagerClient.consumeRequests(this.handleSignatureRequest.bind(this));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle signature request
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ hash: a[0].hash, taskId: a[0].taskId }),
  })
  private async handleSignatureRequest(message: any): Promise<void> {
    if (!message) return;

    try {
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

      // Acknowledge message
      await this.signersManagerClient.ackMessage(message);
    } catch (error) {
      // Reject message and requeue
      await this.signersManagerClient.nackMessage(message, true);
    }
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
