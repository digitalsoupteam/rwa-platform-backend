import { EvaluationRequestsClient } from '../clients/evaluationRequests.client';
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
      const { method, args } = JSON.parse(message.content.toString()) as RpcMessage;

      if (method === 'evaluatePool') {
        const { poolId, ownerId, ownerType } = args as { poolId: string; ownerId: string; ownerType: string };
        await this.riskEvaluationService.evaluatePool({ poolId, ownerId, ownerType });
      } else if (method === 'evaluateBusiness') {
        const { businessId, ownerId, ownerType } = args as { businessId: string; ownerId: string; ownerType: string };
        await this.riskEvaluationService.evaluateBusiness({ businessId, ownerId, ownerType });
      } else {
        throw new AppError({
          message: `Unknown method: ${method}`,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      await this.evaluationRequestsClient.ackMessage(message);
    } catch (error) {
      logger.error('Failed to handle evaluation request:', error);
      await this.evaluationRequestsClient.nackMessage(message, false);
    }
  }
}
