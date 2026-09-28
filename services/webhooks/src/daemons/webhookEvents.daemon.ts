import type { ConsumeMessage } from 'amqplib';
import { WebhookEventsClient } from '../clients/webhookEvents.client';
import { WebhookDeliveryClient } from '../clients/webhookDelivery.client';
import { WebhookService } from '../services/webhook.service';
import { DeliveryService } from '../services/delivery.service';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { metrics } from '@shared/monitoring/src/metrics';

interface WebhookEventMessage {
  id: string;
  type: string;
  timestamp: number;
  payload: unknown;
}

/** A unique-index conflict: this endpoint's delivery log already exists. */
const isDuplicateKeyError = (error: unknown): boolean => {
  const e = error as { code?: unknown; message?: unknown };
  return e?.code === 11000 || e?.code === '11000' || /E11000/.test(String(e?.message ?? ''));
};

export class WebhookEventsDaemon {
  constructor(
    private readonly webhookEventsClient: WebhookEventsClient,
    private readonly webhookDeliveryClient: WebhookDeliveryClient,
    private readonly webhookService: WebhookService,
    private readonly deliveryService: DeliveryService,
  ) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    await this.webhookEventsClient.consumeEvents(this.handleEvent.bind(this));
    logger.info('Webhook events daemon initialized, consuming from webhooks.events.webhooks queue');
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ routingKey: a[0]?.fields?.routingKey }),
  })
  private async handleEvent(message: ConsumeMessage | null): Promise<void> {
    if (!message) return;

    try {
      const event: WebhookEventMessage = JSON.parse(message.content.toString());
      metrics.counter('webhook_events_received_total', { type: event.type });

      // Find endpoints subscribed to this event type
      const endpoints = await this.webhookService.findEndpointsByEvent(event.type);

      if (endpoints.length === 0) {
        // No subscribers, ack and move on
        await this.webhookEventsClient.ackMessage(message);
        return;
      }

      let failed = false;

      for (const endpoint of endpoints) {
        // One failing subscriber must not stop the others: errors are isolated
        // per endpoint and reported for the whole message at the end.
        try {
          await this.enqueueDelivery(endpoint, event);
        } catch (error: any) {
          if (isDuplicateKeyError(error)) {
            // The event was already enqueued for this endpoint (redelivery
            // after a crash): at-least-once, skip instead of failing the batch.
            logger.debug('Delivery already enqueued, skipping endpoint', {
              endpointId: endpoint._id.toString(),
              eventId: event.id,
            });
            continue;
          }

          failed = true;
          logger.error('Failed to enqueue delivery', {
            endpointId: endpoint._id.toString(),
            eventId: event.id,
            error,
          });
        }
      }

      if (failed) {
        // One automatic redelivery, then park the event in the DLQ (the queue
        // has a dead-letter config): retrying forever would spin on a
        // persistent failure.
        const redelivered = message.fields?.redelivered === true;
        await this.webhookEventsClient.nackMessage(message, !redelivered);
        return;
      }

      await this.webhookEventsClient.ackMessage(message);
    } catch (error) {
      // Same rule as for per-endpoint failures: one automatic redelivery,
      // then park (a poison message must not spin forever).
      logger.error('Failed to handle webhook event:', error);
      const redelivered = message.fields?.redelivered === true;
      await this.webhookEventsClient.nackMessage(message, !redelivered);
    }
  }

  /**
   * Checks the breaker/rate limit and enqueues one delivery (log first) for a
   * single endpoint. Skips are not failures: the event is still acked.
   */
  private async enqueueDelivery(endpoint: any, event: WebhookEventMessage): Promise<void> {
    // Check if endpoint is active (circuit breaker)
    const isActive = await this.webhookService.isEndpointActive(endpoint._id.toString());
    if (!isActive) {
      logger.warn('Endpoint is inactive, skipping', { endpointId: endpoint._id.toString() });
      return;
    }

    // Check rate limit
    const withinLimit = await this.webhookService.checkRateLimit(
      endpoint._id.toString(),
      endpoint.rateLimitPerMinute,
    );
    if (!withinLimit) {
      logger.warn('Rate limit exceeded, skipping', { endpointId: endpoint._id.toString() });
      return;
    }

    // Create delivery log
    const deliveryLogId = await this.deliveryService.createDeliveryLog({
      endpointId: endpoint._id.toString(),
      eventType: event.type,
      eventId: event.id,
      payload: event.payload,
    });

    // Enqueue delivery
    await this.webhookDeliveryClient.sendToDeliveryQueue({
      endpointId: endpoint._id.toString(),
      eventId: event.id,
      eventType: event.type,
      payload: event.payload,
      attempt: 0,
      maxAttempts: endpoint.maxAttempts,
      url: endpoint.url,
      secret: endpoint.secret,
      deliveryLogId,
    });
  }
}
