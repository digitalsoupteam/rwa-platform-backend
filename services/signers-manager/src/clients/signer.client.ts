import { ConsumeMessage } from "amqplib";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { logger } from "@shared/monitoring/src/logger";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

export interface SignatureRequest {
  hash: string;
  taskId: string;
  expired: number;
}

@TracingDecorator()
export class SignerClient {
  private readonly SIGN_EXCHANGE = "sign.exchange";
  private readonly RESPONSES_QUEUE = "sign.responses";

  constructor(private readonly rabbitClient: RabbitMQClient) {}

  async initialize(): Promise<void> {
    // Setup exchange and queues
    await this.rabbitClient.setupExchange(this.SIGN_EXCHANGE, 'fanout', {
      durable: true
    });

    await this.rabbitClient.setupQueue(this.RESPONSES_QUEUE, {
      durable: true,
      arguments: {
        "x-message-ttl": 3600000 // 1 hour
      }
    });
  }

  /**
   * Send signature request to signers
   */
  async sendSignatureTask(request: SignatureRequest): Promise<void> {
    await this.rabbitClient.publish(this.SIGN_EXCHANGE, '', request);
    logger.debug("Sent signature request", { taskId: request.taskId });
  }

  /**
   * Start consuming signature responses
   */
  async consumeResponses(handler: (msg: ConsumeMessage | null) => Promise<void>): Promise<void> {
    await this.rabbitClient.consume(this.RESPONSES_QUEUE, handler, { noAck: false });
    logger.info(`Started consuming responses from queue ${this.RESPONSES_QUEUE}`);
  }

  async ackMessage(msg: ConsumeMessage): Promise<void> {
    await this.rabbitClient.ack(msg);
  }

  async nackMessage(msg: ConsumeMessage, requeue: boolean = true): Promise<void> {
    await this.rabbitClient.nack(msg, requeue);
  }
}