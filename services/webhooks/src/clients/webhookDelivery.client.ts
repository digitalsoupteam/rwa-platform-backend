import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

/** The queue every scheduled delivery lands in; consumed through ReliableConsumer. */
export const WEBHOOK_DELIVERY_QUEUE = 'webhook.delivery';

/**
 * Retry buckets: one queue per backoff step. A failed delivery is republished
 * into the matching bucket; the queue holds it for the TTL and dead-letters it
 * back into `webhook.delivery`, so scheduled retries survive restarts (no
 * in-memory timers). The schedule follows the common industry shape
 * (~8 attempts spread over ~24 hours).
 */
export const WEBHOOK_RETRY_SCHEDULE: ReadonlyArray<{ queue: string; ttlMs: number }> = [
  { queue: 'webhook.delivery.retry.5s', ttlMs: 5_000 },
  { queue: 'webhook.delivery.retry.5m', ttlMs: 5 * 60_000 },
  { queue: 'webhook.delivery.retry.30m', ttlMs: 30 * 60_000 },
  { queue: 'webhook.delivery.retry.2h', ttlMs: 2 * 60 * 60_000 },
  { queue: 'webhook.delivery.retry.5h', ttlMs: 5 * 60 * 60_000 },
  { queue: 'webhook.delivery.retry.10h', ttlMs: 10 * 60 * 60_000 },
];

export class WebhookDeliveryClient {
  private readonly DLQ_EXCHANGE = 'webhooks.dlq';
  private readonly DLQ_QUEUE = 'webhook.delivery.dlq';
  private readonly DLQ_ROUTING_KEY = 'webhook.delivery.dlq';
  private readonly RETRY_EXCHANGE = 'webhooks.retries';
  private readonly RETRY_ROUTING_KEY = 'webhook.delivery';

  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    // Setup DLQ exchange
    await this.rabbitClient.setupExchange(this.DLQ_EXCHANGE, 'direct', { durable: true });

    // Setup delivery queue with DLQ config
    await this.rabbitClient.setupQueue(WEBHOOK_DELIVERY_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.DLQ_EXCHANGE,
        'x-dead-letter-routing-key': this.DLQ_ROUTING_KEY,
      },
    });

    // Setup DLQ queue
    await this.rabbitClient.setupQueue(this.DLQ_QUEUE, { durable: true });
    await this.rabbitClient.bindQueue(this.DLQ_QUEUE, this.DLQ_EXCHANGE, this.DLQ_ROUTING_KEY);

    // Setup retry buckets; expired messages return to the delivery queue.
    await this.rabbitClient.setupExchange(this.RETRY_EXCHANGE, 'direct', { durable: true });
    for (const step of WEBHOOK_RETRY_SCHEDULE) {
      await this.rabbitClient.setupQueue(step.queue, {
        durable: true,
        arguments: {
          'x-message-ttl': step.ttlMs,
          'x-dead-letter-exchange': this.RETRY_EXCHANGE,
          'x-dead-letter-routing-key': this.RETRY_ROUTING_KEY,
        },
      });
    }
    await this.rabbitClient.bindQueue(WEBHOOK_DELIVERY_QUEUE, this.RETRY_EXCHANGE, this.RETRY_ROUTING_KEY);

    logger.info('Webhook delivery queue initialized with DLQ and retry buckets');
  }

  @TraceDecorator()
  async sendToDeliveryQueue(content: any): Promise<void> {
    await this.rabbitClient.sendToQueue(WEBHOOK_DELIVERY_QUEUE, content, {
      persistent: true,
    });
  }
}
