import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export interface EvaluationResultMessage {
  evaluationId: string;
  entityType: string;
  entityId: string;
  riskScore: number;
}

export class EvaluationResultsClient {
  private readonly EVALUATION_RESULTS_QUEUE = 'evaluation.results';

  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    await this.rabbitClient.setupQueue(this.EVALUATION_RESULTS_QUEUE, {
      durable: true,
    });
  }

  @TraceDecorator()
  async publishEvaluationResult(result: EvaluationResultMessage): Promise<void> {
    await this.rabbitClient.sendToQueue(this.EVALUATION_RESULTS_QUEUE, result);
  }
}
