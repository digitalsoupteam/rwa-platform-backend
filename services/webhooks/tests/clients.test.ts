/**
 * Unit tests for the two RabbitMQ-backed clients of the webhooks service.
 *
 * Scope: the client wrappers only. The RabbitMQClient they wrap is replaced
 * with an in-memory fake (tests/fakes/rabbitmq.client.fake.ts) that records the
 * topology setup and captures consume handlers — no broker, no connection.
 * These tests pin the queue/exchange/DLQ/retry wiring and the argument
 * forwarding that the daemons and the delivery pipeline rely on.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { WebhookEventsClient } from '../src/clients/webhookEvents.client';
import { WebhookDeliveryClient, WEBHOOK_RETRY_SCHEDULE } from '../src/clients/webhookDelivery.client';
import { WebhookEventTypeList } from '../src/models/shared/enums.model';
import { createFakeRabbitMQClient, type FakeRabbitMQClient } from './fakes/rabbitmq.client.fake';
import { createSyntheticMessage } from './fakes/consumerMessage.fake';

describe('WebhookEventsClient (unit, fake rabbit)', () => {
  let rabbit: FakeRabbitMQClient;
  let client: WebhookEventsClient;

  beforeEach(() => {
    rabbit = createFakeRabbitMQClient();
    client = new WebhookEventsClient(rabbit as unknown as RabbitMQClient);
  });

  test('initialize: declares the exchange, the DLQ and one binding per event type', async () => {
    await client.initialize();

    expect(rabbit.setupExchange).toHaveBeenCalledWith('webhooks.events', 'direct', { durable: true });
    // Queue arguments are immutable in RabbitMQ: an existing environment must
    // recreate `webhooks.events.webhooks` once for these args to take effect.
    expect(rabbit.setupQueue).toHaveBeenCalledWith('webhooks.events.webhooks', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'webhooks.events.dlq',
        'x-dead-letter-routing-key': 'webhook.events.dlq',
      },
    });
    expect(rabbit.setupExchange).toHaveBeenCalledWith('webhooks.events.dlq', 'direct', { durable: true });
    expect(rabbit.setupQueue).toHaveBeenCalledWith('webhook.events.dlq', { durable: true });
    expect(rabbit.bindQueue).toHaveBeenCalledWith('webhook.events.dlq', 'webhooks.events.dlq', 'webhook.events.dlq');

    const bindings = rabbit.setups.filter((entry) => entry.kind === 'binding').map((entry) => entry.args);
    const eventBindings = bindings.filter((args) => args[1] === 'webhooks.events');
    expect(eventBindings).toHaveLength(WebhookEventTypeList.length);
    expect(eventBindings.map((args) => args[2]).sort()).toEqual([...WebhookEventTypeList].sort());
    expect(eventBindings).toContainEqual(['webhooks.events.webhooks', 'webhooks.events', 'pool.deployed']);
    expect(eventBindings).toContainEqual(['webhooks.events.webhooks', 'webhooks.events', 'business.deployed']);
  });

  test('consumeEvents: consumes with manual acknowledgements and hands the handler through', async () => {
    const handler = async () => {};

    await client.consumeEvents(handler);

    expect(rabbit.consume).toHaveBeenCalledWith('webhooks.events.webhooks', handler, { noAck: false });
    expect(rabbit.handlers.get('webhooks.events.webhooks')).toBe(handler);
  });

  test('ackMessage/nackMessage: forward to the RabbitMQ client, nack requeue defaults to true', async () => {
    const message = createSyntheticMessage({ id: 'evt-1' });

    await client.ackMessage(message);
    expect(rabbit.ack).toHaveBeenCalledWith(message);

    await client.nackMessage(message, false);
    expect(rabbit.nack).toHaveBeenCalledWith(message, false);

    await client.nackMessage(message);
    expect(rabbit.nack).toHaveBeenLastCalledWith(message, true);
    expect(rabbit.nacked.map((entry) => entry.requeue)).toEqual([false, true]);
  });
});

describe('WebhookDeliveryClient (unit, fake rabbit)', () => {
  let rabbit: FakeRabbitMQClient;
  let client: WebhookDeliveryClient;

  beforeEach(() => {
    rabbit = createFakeRabbitMQClient();
    client = new WebhookDeliveryClient(rabbit as unknown as RabbitMQClient);
  });

  test('initialize: wires the delivery queue to the dead-letter exchange', async () => {
    await client.initialize();

    expect(rabbit.setupExchange).toHaveBeenCalledWith('webhooks.dlq', 'direct', { durable: true });
    expect(rabbit.setupQueue).toHaveBeenCalledWith('webhook.delivery', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'webhooks.dlq',
        'x-dead-letter-routing-key': 'webhook.delivery.dlq',
      },
    });
    expect(rabbit.setupQueue).toHaveBeenCalledWith('webhook.delivery.dlq', { durable: true });
    expect(rabbit.bindQueue).toHaveBeenCalledWith('webhook.delivery.dlq', 'webhooks.dlq', 'webhook.delivery.dlq');
  });

  test('initialize: declares one retry bucket per backoff step, dead-lettering back into delivery', async () => {
    await client.initialize();

    expect(rabbit.setupExchange).toHaveBeenCalledWith('webhooks.retries', 'direct', { durable: true });
    for (const step of WEBHOOK_RETRY_SCHEDULE) {
      expect(rabbit.setupQueue).toHaveBeenCalledWith(step.queue, {
        durable: true,
        arguments: {
          'x-message-ttl': step.ttlMs,
          'x-dead-letter-exchange': 'webhooks.retries',
          'x-dead-letter-routing-key': 'webhook.delivery',
        },
      });
    }
    expect(rabbit.bindQueue).toHaveBeenCalledWith('webhook.delivery', 'webhooks.retries', 'webhook.delivery');
  });

  test('sendToDeliveryQueue: publishes a persistent message to the delivery queue', async () => {
    const content = { endpointId: 'endpoint-1', eventId: 'evt-1', attempt: 0 };

    await client.sendToDeliveryQueue(content);

    expect(rabbit.sendToQueue).toHaveBeenCalledWith('webhook.delivery', content, { persistent: true });
    expect(rabbit.sent[0].content).toBe(content);
  });

  test('sendToRetryQueue: picks the bucket for the attempt and caps at the slowest step', async () => {
    const content = { endpointId: 'endpoint-1', eventId: 'evt-1', attempt: 1 };

    await client.sendToRetryQueue(0, content);
    expect(rabbit.sendToQueue).toHaveBeenLastCalledWith('webhook.delivery.retry.5s', content, { persistent: true });

    await client.sendToRetryQueue(2, content);
    expect(rabbit.sendToQueue).toHaveBeenLastCalledWith('webhook.delivery.retry.30m', content, { persistent: true });

    // Attempts beyond the schedule reuse the last bucket (maxAttempts caps the count).
    await client.sendToRetryQueue(WEBHOOK_RETRY_SCHEDULE.length + 10, content);
    expect(rabbit.sendToQueue).toHaveBeenLastCalledWith('webhook.delivery.retry.10h', content, { persistent: true });
  });

  test('consumeDelivery: consumes with manual acknowledgements and hands the handler through', async () => {
    const handler = async () => {};

    await client.consumeDelivery(handler);

    expect(rabbit.consume).toHaveBeenCalledWith('webhook.delivery', handler, { noAck: false });
    expect(rabbit.handlers.get('webhook.delivery')).toBe(handler);
  });

  test('ackMessage/nackMessage: forward to the RabbitMQ client, nack requeue defaults to true', async () => {
    const message = createSyntheticMessage({ endpointId: 'endpoint-1' }, { exchange: 'webhooks.dlq' });

    await client.ackMessage(message);
    expect(rabbit.ack).toHaveBeenCalledWith(message);

    await client.nackMessage(message, false);
    expect(rabbit.nack).toHaveBeenCalledWith(message, false);

    await client.nackMessage(message);
    expect(rabbit.nack).toHaveBeenLastCalledWith(message, true);
    expect(rabbit.nacked.map((entry) => entry.requeue)).toEqual([false, true]);
  });
});
