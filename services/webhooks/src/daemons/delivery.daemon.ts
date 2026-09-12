import type { ConsumeMessage } from 'amqplib';
import { WebhookDeliveryClient } from '../clients/webhookDelivery.client';
import { DeliveryService } from '../services/delivery.service';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

interface DeliveryMessage {
  endpointId: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  attempt: number;
  maxAttempts: number;
  url: string;
  secret: string;
  deliveryLogId: string;
}

export class DeliveryDaemon {
  constructor(
    private readonly webhookDeliveryClient: WebhookDeliveryClient,
    private readonly deliveryService: DeliveryService,
  ) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    await this.webhookDeliveryClient.consumeDelivery(this.handleDelivery.bind(this));
    logger.info('Delivery daemon initialized, consuming from webhook.delivery queue');
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ endpointId: a[0]?.content?.endpointId, eventId: a[0]?.content?.eventId }),
  })
  private async handleDelivery(message: ConsumeMessage | null): Promise<void> {
    if (!message) return;

    try {
      const delivery: DeliveryMessage = JSON.parse(message.content.toString());

      const result = await this.deliveryService.deliverWebhook({
        endpointId: delivery.endpointId,
        eventId: delivery.eventId,
        eventType: delivery.eventType,
        payload: delivery.payload,
        attempt: delivery.attempt + 1,
        maxAttempts: delivery.maxAttempts,
        url: delivery.url,
        secret: delivery.secret,
        deliveryLogId: delivery.deliveryLogId,
      });

      if (result.success) {
        await this.webhookDeliveryClient.ackMessage(message);
      } else if (result.deadLetter) {
        // nack(requeue=false) → DLQ
        await this.webhookDeliveryClient.nackMessage(message, false);
      } else if (result.retry) {
        // Re-enqueue with incremented attempt
        const retryDelay = Math.min(1000 * Math.pow(2, delivery.attempt) + Math.random() * 250, 128000);
        const retryMessage: DeliveryMessage = {
          ...delivery,
          attempt: delivery.attempt + 1,
        };

        // ack current, send new with delay
        await this.webhookDeliveryClient.ackMessage(message);
        setTimeout(async () => {
          try {
            await this.webhookDeliveryClient.sendToDeliveryQueue(retryMessage);
          } catch (error) {
            logger.error('Failed to re-enqueue delivery for retry:', error);
          }
        }, retryDelay);
      }
    } catch (error) {
      logger.error('Failed to handle delivery:', error);
      await this.webhookDeliveryClient.nackMessage(message, false);
    }
  }
}
