import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { ReliableConsumer, done, type ConsumeOutcome } from '@shared/rabbitmq/src/reliableConsumer';
import { hasErrorCode, isTransientDbError } from '@shared/rabbitmq/src/reliability';
import { EVALUATION_REQUESTS_QUEUE } from '../clients/evaluationRequests.client';
import { RiskEvaluationService } from '../services/riskEvaluation.service';
import type { ConsumeMessage } from 'amqplib';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { AppError } from '@shared/errors/app-errors';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

interface RpcMessage {
  method: 'evaluatePool' | 'evaluateBusiness';
  args: Record<string, unknown>;
}

const MAX_REQUEST_RETRIES = 3;

export class EvaluationRequestsDaemon {
  private readonly reliableConsumer: ReliableConsumer;

  constructor(
    rabbitMQClient: RabbitMQClient,
    private readonly riskEvaluationService: RiskEvaluationService,
  ) {
    this.reliableConsumer = new ReliableConsumer(rabbitMQClient, EVALUATION_REQUESTS_QUEUE, {
      retry: { mode: 'dlx', retryQueue: `${EVALUATION_REQUESTS_QUEUE}.retry`, maxAttempts: MAX_REQUEST_RETRIES },
      exhausted: 'park',
      park: { mode: 'envelope', queue: `${EVALUATION_REQUESTS_QUEUE}.parked` },
      // Unavailable upstreams and databases recover by themselves; a retry
      // re-runs the whole evaluation pipeline.
      isTransient: (error) => isTransientDbError(error) || hasErrorCode(error, 'UPSTREAM_ERROR'),
      isPermanent: (error) => hasErrorCode(error, 'VALIDATION_ERROR'),
      metricNames: {
        retried: 'evaluation_request_retries_total',
        transientRetried: 'evaluation_request_transient_retries_total',
        parked: 'evaluation_request_parked_total',
      },
    });
  }

  @TraceDecorator()
  async initialize(): Promise<void> {
    await this.reliableConsumer.consume((message) => this.handleRequest(message));
    logger.info('Evaluation requests daemon initialized, consuming from evaluation.requests queue');
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ routingKey: a[0]?.fields?.routingKey }),
  })
  private async handleRequest(message: ConsumeMessage): Promise<ConsumeOutcome | void> {
    let request: RpcMessage;
    try {
      request = JSON.parse(message.content.toString()) as RpcMessage;
    } catch (error) {
      throw new AppError({
        message: 'Evaluation request is not valid JSON',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        cause: error,
      });
    }

    if (request.method === 'evaluatePool') {
      const { poolId, ownerId, ownerType } = request.args as { poolId: string; ownerId: string; ownerType: string };
      await this.riskEvaluationService.evaluatePool({ poolId, ownerId, ownerType });
    } else if (request.method === 'evaluateBusiness') {
      const { businessId, ownerId, ownerType } = request.args as {
        businessId: string;
        ownerId: string;
        ownerType: string;
      };
      await this.riskEvaluationService.evaluateBusiness({ businessId, ownerId, ownerType });
    } else {
      throw new AppError({
        message: `Unknown method: ${request.method}`,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    return done;
  }
}
