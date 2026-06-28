import type { ConsumeMessage } from 'amqplib';
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
  async consumeRequests(handler: (msg: ConsumeMessage | null) => Promise<void>): Promise<void> {
    await this.rabbitClient.consume(this.EVALUATION_REQUESTS_QUEUE, handler, { noAck: false });
  }

  @TraceDecorator()
  async ackMessage(msg: ConsumeMessage): Promise<void> {
    await this.rabbitClient.ack(msg);
  }

  @TraceDecorator()
  async nackMessage(msg: ConsumeMessage, requeue: boolean = true): Promise<void> {
    await this.rabbitClient.nack(msg, requeue);
  }
}
