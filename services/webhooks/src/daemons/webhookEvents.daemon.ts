import type { ConsumeMessage } from 'amqplib';
import { WebhookEventsClient } from '../clients/webhookEvents.client';
import { WebhookDeliveryClient } from '../clients/webhookDelivery.client';
import { RedisClient } from '../clients/redis.client';
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

export class WebhookEventsDaemon {
  constructor(
    private readonly webhookEventsClient: WebhookEventsClient,
    private readonly webhookDeliveryClient: WebhookDeliveryClient,
    private readonly redisClient: RedisClient,
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

      for (const endpoint of endpoints) {
        // Check if endpoint is active (circuit breaker)
        const isActive = await this.webhookService.isEndpointActive(endpoint._id.toString());
        if (!isActive) {
          logger.warn('Endpoint is inactive, skipping', { endpointId: endpoint._id.toString() });
          continue;
        }

        // Check rate limit
        const withinLimit = await this.webhookService.checkRateLimit(
          endpoint._id.toString(),
          endpoint.rateLimitPerMinute,
        );
        if (!withinLimit) {
          logger.warn('Rate limit exceeded, skipping', { endpointId: endpoint._id.toString() });
          continue;
        }

        // Check payload size
        const body = JSON.stringify(event.payload);
        if (Buffer.byteLength(body, 'utf8') > 256 * 1024) {
          logger.warn('Event payload exceeds max size, truncating', { eventId: event.id });
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

      await this.webhookEventsClient.ackMessage(message);
    } catch (error) {
      logger.error('Failed to handle webhook event:', error);
      await this.webhookEventsClient.nackMessage(message, false);
    }
  }
}
