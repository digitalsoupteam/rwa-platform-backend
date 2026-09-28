import type { ConsumeMessage } from 'amqplib';
import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { WebhookEventTypeList } from '../models/shared/enums.model';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export class WebhookEventsClient {
  private readonly EVENTS_QUEUE = 'webhooks.events.webhooks';
  private readonly EVENTS_EXCHANGE = 'webhooks.events';
  private readonly DLQ_EXCHANGE = 'webhooks.events.dlq';
  private readonly DLQ_QUEUE = 'webhook.events.dlq';
  private readonly DLQ_ROUTING_KEY = 'webhook.events.dlq';

  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    // Setup exchange
    await this.rabbitClient.setupExchange(this.EVENTS_EXCHANGE, 'direct', { durable: true });

    // Failed events are parked in the DLQ instead of being dropped.
    // NOTE: queue arguments are immutable in RabbitMQ — when upgrading an
    // existing environment, delete `webhooks.events.webhooks` once before
    // starting the new version so it is recreated with the dead-letter args.
    await this.rabbitClient.setupQueue(this.EVENTS_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.DLQ_EXCHANGE,
        'x-dead-letter-routing-key': this.DLQ_ROUTING_KEY,
      },
    });

    // Bind queue to each event type
    for (const eventType of WebhookEventTypeList) {
      await this.rabbitClient.bindQueue(this.EVENTS_QUEUE, this.EVENTS_EXCHANGE, eventType);
    }

    // Dead-letter destination for events that failed processing.
    await this.rabbitClient.setupExchange(this.DLQ_EXCHANGE, 'direct', { durable: true });
    await this.rabbitClient.setupQueue(this.DLQ_QUEUE, { durable: true });
    await this.rabbitClient.bindQueue(this.DLQ_QUEUE, this.DLQ_EXCHANGE, this.DLQ_ROUTING_KEY);

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
