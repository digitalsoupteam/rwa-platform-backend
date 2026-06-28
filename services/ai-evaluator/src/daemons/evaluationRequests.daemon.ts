import { EvaluationRequestsClient } from '../clients/evaluationRequests.client';
import { RiskEvaluationService } from '../services/riskEvaluation.service';
import type { ConsumeMessage } from 'amqplib';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { AppError } from '@shared/errors/app-errors';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

interface EvaluationRequest {
  entityType: 'pool' | 'business';
  entityId: string;
  ownerId: string;
  ownerType: string;
}

export class EvaluationRequestsDaemon {
  constructor(
    private readonly evaluationRequestsClient: EvaluationRequestsClient,
    private readonly riskEvaluationService: RiskEvaluationService,
  ) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    await this.evaluationRequestsClient.consumeRequests(this.handleRequest.bind(this));
    logger.info('Evaluation requests daemon initialized, consuming from evaluation.requests queue');
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ routingKey: a[0]?.fields?.routingKey }),
  })
  private async handleRequest(message: ConsumeMessage | null): Promise<void> {
    if (!message) return;

    try {
      const request = JSON.parse(message.content.toString()) as EvaluationRequest;

      if (!request.entityType || !request.entityId || !request.ownerId || !request.ownerType) {
        throw new AppError({
          message: 'Invalid evaluation request format',
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      if (request.entityType !== 'pool' && request.entityType !== 'business') {
        throw new AppError({
          message: `Unknown entityType: ${request.entityType}`,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      await this.riskEvaluationService.startEvaluation(request);

      await this.evaluationRequestsClient.ackMessage(message);
    } catch (error) {
      logger.error('Failed to handle evaluation request:', error);
      await this.evaluationRequestsClient.nackMessage(message, false);
    }
  }
}
