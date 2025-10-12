import { ConsumeMessage } from "amqplib";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { logger } from "@shared/monitoring/src/logger";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

export interface SignatureResponse {
  taskId: string;
  signer: string;
  hash: string;
  signature: string;
}

@TracingDecorator()
export class SignersManagerClient {
  private readonly SIGN_EXCHANGE = "sign.exchange";
  private readonly RESPONSES_QUEUE = "sign.responses";
  private requestsQueue: string | null = null;

  constructor(private readonly rabbitClient: RabbitMQClient) {}

  async initialize(): Promise<void> {
    // Setup exchange
    await this.rabbitClient.setupExchange(this.SIGN_EXCHANGE, 'fanout', {
      durable: true
    });

    // Create unique queue for this signer
    const channel = this.rabbitClient.getChannel();
    const { queue } = await channel.assertQueue('', {
      exclusive: true,
      autoDelete: true
    });
    this.requestsQueue = queue;

    // Bind queue to exchange
    await this.rabbitClient.bindQueue(queue, this.SIGN_EXCHANGE, '');

    // Setup responses queue
    await this.rabbitClient.setupQueue(this.RESPONSES_QUEUE, {
      durable: true,
      arguments: {
        "x-message-ttl": 3600000 // 1 hour
      }
    });
  }

  /**
   * Send signature response back to the manager
   */
  async sendSignature(response: SignatureResponse): Promise<void> {
    await this.rabbitClient.sendToQueue(this.RESPONSES_QUEUE, response);
  }

  /**
   * Start consuming signature requests
   */
  async consumeRequests(handler: (msg: ConsumeMessage | null) => Promise<void>): Promise<void> {
    if (!this.requestsQueue) {
      throw new Error("Requests queue not initialized");
    }

    await this.rabbitClient.consume(this.requestsQueue, handler, { noAck: false });
    logger.info(`Started consuming requests from queue ${this.requestsQueue}`);
  }

  async ackMessage(msg: ConsumeMessage): Promise<void> {
    await this.rabbitClient.ack(msg);
  }

  async nackMessage(msg: ConsumeMessage, requeue: boolean = true): Promise<void> {
    await this.rabbitClient.nack(msg, requeue);
  }
}