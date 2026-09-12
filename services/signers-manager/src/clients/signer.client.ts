import type { ConsumeMessage } from 'amqplib';
import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export interface SignatureRequest {
  hash: string;
  taskId: string;
  expired: number;
}

export class SignerClient {
  private readonly SIGN_EXCHANGE = 'sign.exchange';
  private readonly RESPONSES_QUEUE = 'sign.responses';

  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    // Setup exchange and queues
    await this.rabbitClient.setupExchange(this.SIGN_EXCHANGE, 'fanout', {
      durable: true,
    });

    await this.rabbitClient.setupQueue(this.RESPONSES_QUEUE, {
      durable: true,
      arguments: {
        'x-message-ttl': 3600000, // 1 hour
      },
    });
  }

  /**
   * Send signature request to signers
   */
  @TraceDecorator()
  async sendSignatureTask(request: SignatureRequest): Promise<void> {
    await this.rabbitClient.publish(this.SIGN_EXCHANGE, '', request);
  }

  /**
   * Start consuming signature responses
   */
  @TraceDecorator()
  async consumeResponses(handler: (msg: ConsumeMessage | null) => Promise<void>): Promise<void> {
    await this.rabbitClient.consume(this.RESPONSES_QUEUE, handler, { noAck: false });
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
