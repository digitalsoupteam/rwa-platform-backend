import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export interface EvaluationRequestMessage {
  entityType: 'pool' | 'business';
  entityId: string;
  ownerId: string;
  ownerType: string;
}

export class EvaluationRequestsClient {
  private readonly EVALUATION_REQUESTS_QUEUE = 'evaluation.requests';

  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    await this.rabbitClient.setupQueue(this.EVALUATION_REQUESTS_QUEUE, {
      durable: true,
    });
  }

  @TraceDecorator()
  async publishEvaluationRequest(request: EvaluationRequestMessage): Promise<void> {
    await this.rabbitClient.sendToQueue(this.EVALUATION_REQUESTS_QUEUE, request);
  }
}
