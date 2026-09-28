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
    args: (a) => {
      try {
        const delivery = JSON.parse(a[0]?.content?.toString() ?? '');
        return { endpointId: delivery.endpointId, eventId: delivery.eventId };
      } catch {
        return {};
      }
    },
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
        // Park the message in the retry bucket for the next backoff step, then
        // ack. The retry message is published first: if the broker rejects it,
        // the current message is requeued instead of being lost.
        const retryMessage: DeliveryMessage = {
          ...delivery,
          attempt: delivery.attempt + 1,
        };

        try {
          await this.webhookDeliveryClient.sendToRetryQueue(delivery.attempt, retryMessage);
          await this.webhookDeliveryClient.ackMessage(message);
        } catch (error) {
          logger.error('Failed to schedule delivery retry:', error);
          await this.webhookDeliveryClient.nackMessage(message, true);
        }
      }
    } catch (error) {
      logger.error('Failed to handle delivery:', error);
      await this.webhookDeliveryClient.nackMessage(message, false);
    }
  }
}
