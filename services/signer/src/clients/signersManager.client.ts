import type { ConsumeMessage } from 'amqplib';
import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export interface SignatureResponse {
  taskId: string;
  signer: string;
  hash: string;
  signature: string;
}

export class SignersManagerClient {
  private readonly SIGN_EXCHANGE = 'sign.exchange';
  private readonly RESPONSES_QUEUE = 'sign.responses';
  private readonly REQUESTS_QUEUE: string;

  constructor(
    private readonly rabbitClient: RabbitMQClient,
    signerAddress: string,
  ) {
    // Durable per-signer queue: a request sent while this signer is down stays
    // in the queue and is processed after it comes back (until the TTL kicks in).
    this.REQUESTS_QUEUE = `sign.requests.${signerAddress.toLowerCase()}`;
  }

  @TraceDecorator()
  async initialize(): Promise<void> {
    // Setup exchange
    await this.rabbitClient.setupExchange(this.SIGN_EXCHANGE, 'fanout', {
      durable: true,
    });

    // Setup per-signer requests queue
    await this.rabbitClient.setupQueue(this.REQUESTS_QUEUE, {
      durable: true,
      arguments: {
        'x-message-ttl': 900000, // 15 minutes - requests are useless after the signing window
      },
    });
    await this.rabbitClient.bindQueue(this.REQUESTS_QUEUE, this.SIGN_EXCHANGE, '');

    // Setup responses queue
    await this.rabbitClient.setupQueue(this.RESPONSES_QUEUE, {
      durable: true,
      arguments: {
        'x-message-ttl': 3600000, // 1 hour
      },
    });
  }

  /**
   * Send signature response back to the manager
   */
  @TraceDecorator()
  async sendSignature(response: SignatureResponse): Promise<void> {
    await this.rabbitClient.sendToQueue(this.RESPONSES_QUEUE, response);
  }

  /**
   * Start consuming signature requests
   */
  @TraceDecorator()
  async consumeRequests(handler: (msg: ConsumeMessage | null) => Promise<void>): Promise<void> {
    await this.rabbitClient.consume(this.REQUESTS_QUEUE, handler, { noAck: false });
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
