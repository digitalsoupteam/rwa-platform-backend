import type { ConsumeMessage } from 'amqplib';
import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { ReliableConsumer, done, type ConsumeOutcome } from '@shared/rabbitmq/src/reliableConsumer';
import { WEBHOOK_DELIVERY_QUEUE, WEBHOOK_RETRY_SCHEDULE } from '../clients/webhookDelivery.client';
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
  private readonly reliableConsumer: ReliableConsumer;

  constructor(
    rabbitMQClient: RabbitMQClient,
    private readonly deliveryService: DeliveryService,
  ) {
    this.reliableConsumer = new ReliableConsumer(rabbitMQClient, WEBHOOK_DELIVERY_QUEUE, {
      // Long backoff schedule: a failed delivery is republished into the bucket
      // for the next step; the delivery service decides when attempts are
      // exhausted (dead letter).
      retry: { mode: 'buckets', steps: WEBHOOK_RETRY_SCHEDULE, attemptField: 'attempt' },
      exhausted: 'park',
      park: { mode: 'dlx' },
      metricNames: {
        retried: 'webhook_delivery_retried_total',
        parked: 'webhook_delivery_parked_total',
      },
    });
  }

  @TraceDecorator()
  async initialize(): Promise<void> {
    await this.reliableConsumer.consume((message) => this.handleDelivery(message));
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
  private async handleDelivery(message: ConsumeMessage): Promise<ConsumeOutcome | void> {
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
      return done;
    }

    if (result.deadLetter) {
      // nack(requeue=false) through the reliability contract → DLQ
      return { kind: 'park', reason: 'Dead-lettered by the delivery service' };
    }

    if (result.retry) {
      // Republished into the retry bucket for the next backoff step.
      return { kind: 'retry' };
    }

    return done;
  }
}
