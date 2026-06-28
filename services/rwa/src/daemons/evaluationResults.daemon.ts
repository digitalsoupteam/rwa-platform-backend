import { EvaluationResultsClient } from '../clients/evaluationResults.client';
import { PoolService } from '../services/pool.service';
import { BusinessService } from '../services/business.service';
import type { ConsumeMessage } from 'amqplib';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { AppError } from '@shared/errors/app-errors';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

interface EvaluationResult {
  evaluationId: string;
  entityType: string;
  entityId: string;
  riskScore: number;
}

export class EvaluationResultsDaemon {
  constructor(
    private readonly evaluationResultsClient: EvaluationResultsClient,
    private readonly poolService: PoolService,
    private readonly businessService: BusinessService,
  ) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    await this.evaluationResultsClient.consumeResults(this.handleResult.bind(this));
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ routingKey: a[0]?.fields?.routingKey }),
  })
  private async handleResult(message: ConsumeMessage | null): Promise<void> {
    if (!message) return;

    try {
      const result = JSON.parse(message.content.toString()) as EvaluationResult;

      if (!result.evaluationId || !result.entityType || !result.entityId || !result.riskScore) {
        throw new AppError({
          message: 'Invalid evaluation result format',
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      if (result.entityType === 'pool') {
        await this.poolService.setRiskScore({
          id: result.entityId,
          riskScore: result.riskScore,
        });
      } else if (result.entityType === 'business') {
        await this.businessService.setRiskScore({
          id: result.entityId,
          riskScore: result.riskScore,
        });
      } else {
        throw new AppError({
          message: `Unknown entityType: ${result.entityType}`,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      await this.evaluationResultsClient.ackMessage(message);
    } catch (error) {
      logger.error('Failed to handle evaluation result:', error);
      await this.evaluationResultsClient.nackMessage(message, false);
    }
  }
}
