import type { ConsumeMessage } from 'amqplib';
import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export class WebhookDeliveryClient {
  private readonly DELIVERY_QUEUE = 'webhook.delivery';
  private readonly DLQ_EXCHANGE = 'webhooks.dlq';
  private readonly DLQ_QUEUE = 'webhook.delivery.dlq';
  private readonly DLQ_ROUTING_KEY = 'webhook.delivery.dlq';

  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    // Setup DLQ exchange
    await this.rabbitClient.setupExchange(this.DLQ_EXCHANGE, 'direct', { durable: true });

    // Setup delivery queue with DLQ config
    await this.rabbitClient.setupQueue(this.DELIVERY_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.DLQ_EXCHANGE,
        'x-dead-letter-routing-key': this.DLQ_ROUTING_KEY,
      },
    });

    // Setup DLQ queue
    await this.rabbitClient.setupQueue(this.DLQ_QUEUE, { durable: true });
    await this.rabbitClient.bindQueue(this.DLQ_QUEUE, this.DLQ_EXCHANGE, this.DLQ_ROUTING_KEY);

    logger.info('Webhook delivery queue initialized with DLQ');
  }

  @TraceDecorator()
  async sendToDeliveryQueue(content: any): Promise<void> {
    await this.rabbitClient.sendToQueue(this.DELIVERY_QUEUE, content, {
      persistent: true,
    });
  }

  @TraceDecorator()
  async consumeDelivery(handler: (msg: ConsumeMessage | null) => Promise<void>): Promise<void> {
    await this.rabbitClient.consume(this.DELIVERY_QUEUE, handler, { noAck: false });
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
