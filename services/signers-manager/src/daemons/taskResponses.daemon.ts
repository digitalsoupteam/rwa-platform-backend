import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { ReliableConsumer, done, type ConsumeOutcome } from '@shared/rabbitmq/src/reliableConsumer';
import { hasErrorCode, isTransientDbError } from '@shared/rabbitmq/src/reliability';
import { SIGN_RESPONSES_QUEUE } from '../clients/signer.client';
import { SignaturesService } from '../services/signatures.service';
import type { ConsumeMessage } from 'amqplib';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { AppError } from '@shared/errors/app-errors';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

interface SignatureResponse {
  signer: string;
  hash: string;
  signature: string;
  taskId: string;
}

const MAX_RESPONSE_RETRIES = 3;

/**
 * Daemon for handling signature responses from signer service
 */

export class TaskResponsesDaemon {
  private readonly reliableConsumer: ReliableConsumer;

  constructor(
    rabbitMQClient: RabbitMQClient,
    private readonly signaturesService: SignaturesService,
  ) {
    this.reliableConsumer = new ReliableConsumer(rabbitMQClient, SIGN_RESPONSES_QUEUE, {
      retry: { mode: 'dlx', retryQueue: `${SIGN_RESPONSES_QUEUE}.retry`, maxAttempts: MAX_RESPONSE_RETRIES },
      exhausted: 'park',
      park: { mode: 'envelope', queue: `${SIGN_RESPONSES_QUEUE}.parked` },
      isTransient: isTransientDbError,
      isPermanent: (error) => hasErrorCode(error, 'VALIDATION_ERROR') || hasErrorCode(error, 'NOT_FOUND'),
      metricNames: {
        retried: 'signature_response_retries_total',
        transientRetried: 'signature_response_transient_retries_total',
        parked: 'signature_response_parked_total',
      },
    });
  }

  /**
   * Initialize daemon and start consuming messages
   */
  @TraceDecorator()
  async initialize(): Promise<void> {
    await this.reliableConsumer.consume((message) => this.handleResponse(message));
  }

  /**
   * Handle signature response
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ routingKey: a[0]?.fields?.routingKey }),
  })
  private async handleResponse(message: ConsumeMessage): Promise<ConsumeOutcome | void> {
    let response: SignatureResponse;
    try {
      response = JSON.parse(message.content.toString()) as SignatureResponse;
    } catch (error) {
      throw new AppError({
        message: 'Invalid signature response format',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        cause: error,
      });
    }

    // Validate response
    if (
      !response ||
      typeof response !== 'object' ||
      !response.signer ||
      !response.hash ||
      !response.signature ||
      !response.taskId
    ) {
      throw new AppError({
        message: 'Invalid signature response format',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    try {
      // Add signature to task
      await this.signaturesService.addSignature({
        taskId: response.taskId,
        signer: response.signer,
        signature: response.signature,
      });
    } catch (error) {
      // Expected outcomes: the response was already applied (duplicate
      // delivery), the task is already completed, or it has expired.
      if (hasErrorCode(error, 11000) || hasErrorCode(error, 'CONFLICT') || hasErrorCode(error, 'EXPIRED')) {
        logger.debug('Ignoring a signature response that is already resolved', {
          taskId: response.taskId,
          signer: response.signer,
        });
        return done;
      }
      throw error;
    }

    return done;
  }
}
