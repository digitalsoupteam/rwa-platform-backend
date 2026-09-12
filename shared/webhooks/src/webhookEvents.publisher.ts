import crypto from 'crypto';
import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export interface WebhookEventMessage {
  id: string;
  type: string;
  timestamp: number;
  payload: unknown;
}

export class WebhookEventsPublisher {
  private readonly EXCHANGE = 'webhooks.events';

  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    await this.rabbitClient.setupExchange(this.EXCHANGE, 'direct', { durable: true });
    logger.info('Webhooks exchange initialized');
  }

  @TraceDecorator()
  async publish(eventType: string, payload: unknown): Promise<void> {
    const message: WebhookEventMessage = {
      id: crypto.randomUUID(),
      type: eventType,
      timestamp: Date.now(),
      payload,
    };

    await this.rabbitClient.publish(this.EXCHANGE, eventType, message);
  }
}
