import type { ConsumeMessage } from 'amqplib';
import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { WebhookEventTypeList } from '../models/shared/enums.model';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export class WebhookEventsClient {
  private readonly EVENTS_QUEUE = 'webhooks.events.webhooks';
  private readonly EVENTS_EXCHANGE = 'webhooks.events';

  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    // Setup exchange
    await this.rabbitClient.setupExchange(this.EVENTS_EXCHANGE, 'direct', { durable: true });

    // Setup queue
    await this.rabbitClient.setupQueue(this.EVENTS_QUEUE, { durable: true });

    // Bind queue to each event type
    for (const eventType of WebhookEventTypeList) {
      await this.rabbitClient.bindQueue(this.EVENTS_QUEUE, this.EVENTS_EXCHANGE, eventType);
    }

    logger.info(`Webhook events queue initialized, bound to ${WebhookEventTypeList.length} event types`);
  }

  @TraceDecorator()
  async consumeEvents(handler: (msg: ConsumeMessage | null) => Promise<void>): Promise<void> {
    await this.rabbitClient.consume(this.EVENTS_QUEUE, handler, { noAck: false });
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
