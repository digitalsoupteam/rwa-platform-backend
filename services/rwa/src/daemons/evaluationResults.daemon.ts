import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { ReliableConsumer, done, type ConsumeOutcome } from '@shared/rabbitmq/src/reliableConsumer';
import { hasErrorCode, isTransientDbError } from '@shared/rabbitmq/src/reliability';
import { EVALUATION_RESULTS_QUEUE } from '../clients/evaluationResults.client';
import { PoolService } from '../services/pool.service';
import { BusinessService } from '../services/business.service';
import type { ConsumeMessage } from 'amqplib';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { AppError } from '@shared/errors/app-errors';

interface EvaluationResult {
  evaluationId: string;
  entityType: string;
  entityId: string;
  status: 'completed' | 'failed';
  riskScore?: number;
}

const MAX_RESULT_RETRIES = 3;

export class EvaluationResultsDaemon {
  private readonly reliableConsumer: ReliableConsumer;

  constructor(
    rabbitMQClient: RabbitMQClient,
    private readonly poolService: PoolService,
    private readonly businessService: BusinessService,
  ) {
    this.reliableConsumer = new ReliableConsumer(rabbitMQClient, EVALUATION_RESULTS_QUEUE, {
      retry: { mode: 'dlx', retryQueue: `${EVALUATION_RESULTS_QUEUE}.retry`, maxAttempts: MAX_RESULT_RETRIES },
      exhausted: 'park',
      park: { mode: 'envelope', queue: `${EVALUATION_RESULTS_QUEUE}.parked` },
      isTransient: isTransientDbError,
      isPermanent: (error) => hasErrorCode(error, 'VALIDATION_ERROR') || hasErrorCode(error, 'NOT_FOUND'),
      metricNames: {
        retried: 'evaluation_result_retries_total',
        transientRetried: 'evaluation_result_transient_retries_total',
        parked: 'evaluation_result_parked_total',
      },
    });
  }

  @TraceDecorator()
  async initialize(): Promise<void> {
    await this.reliableConsumer.consume((message) => this.handleResult(message));
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ routingKey: a[0]?.fields?.routingKey }),
  })
  private async handleResult(message: ConsumeMessage): Promise<ConsumeOutcome | void> {
    let result: EvaluationResult;
    try {
      result = JSON.parse(message.content.toString()) as EvaluationResult;
    } catch (error) {
      throw new AppError({
        message: 'Evaluation result is not valid JSON',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        cause: error,
      });
    }

    if (
      !result ||
      typeof result !== 'object' ||
      !result.evaluationId ||
      !result.entityType ||
      !result.entityId ||
      !result.status
    ) {
      throw new AppError({
        message: 'Invalid evaluation result format',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    if (result.status === 'failed') {
      if (result.entityType === 'pool') {
        await this.poolService.resetEvaluation({ id: result.entityId });
      } else if (result.entityType === 'business') {
        await this.businessService.resetEvaluation({ id: result.entityId });
      } else {
        throw new AppError({
          message: `Unknown entityType: ${result.entityType}`,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }
    } else {
      if (result.entityType === 'pool') {
        await this.poolService.setRiskScore({
          id: result.entityId,
          riskScore: result.riskScore!,
        });
      } else if (result.entityType === 'business') {
        await this.businessService.setRiskScore({
          id: result.entityId,
          riskScore: result.riskScore!,
        });
      } else {
        throw new AppError({
          message: `Unknown entityType: ${result.entityType}`,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }
    }

    return done;
  }
}
