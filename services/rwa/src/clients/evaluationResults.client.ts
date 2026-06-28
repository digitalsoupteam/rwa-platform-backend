import type { ConsumeMessage } from 'amqplib';
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
  async consumeResults(handler: (msg: ConsumeMessage | null) => Promise<void>): Promise<void> {
    await this.rabbitClient.consume(this.EVALUATION_RESULTS_QUEUE, handler, { noAck: false });
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
