/**
 * Unit tests for the two RabbitMQ-backed clients of the webhooks service.
 *
 * Scope: the client wrappers only. The RabbitMQClient they wrap is replaced
 * with an in-memory fake (tests/fakes/rabbitmq.client.fake.ts) that records the
 * topology setup and captures consume handlers — no broker, no connection.
 * These tests pin the queue/exchange/DLQ wiring and the argument forwarding
 * that the daemons and the delivery pipeline rely on.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { WebhookEventsClient } from '../src/clients/webhookEvents.client';
import { WebhookDeliveryClient } from '../src/clients/webhookDelivery.client';
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

  test('initialize: declares the exchange, the queue and one binding per event type', async () => {
    await client.initialize();

    expect(rabbit.setupExchange).toHaveBeenCalledWith('webhooks.events', 'direct', { durable: true });
    expect(rabbit.setupQueue).toHaveBeenCalledWith('webhooks.events.webhooks', { durable: true });

    const bindings = rabbit.setups.filter((entry) => entry.kind === 'binding').map((entry) => entry.args);
    expect(bindings).toHaveLength(WebhookEventTypeList.length);
    expect(bindings.map((args) => args[2]).sort()).toEqual([...WebhookEventTypeList].sort());
    expect(bindings).toContainEqual(['webhooks.events.webhooks', 'webhooks.events', 'pool.created']);
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

  test('sendToDeliveryQueue: publishes a persistent message to the delivery queue', async () => {
    const content = { endpointId: 'endpoint-1', eventId: 'evt-1', attempt: 0 };

    await client.sendToDeliveryQueue(content);

    expect(rabbit.sendToQueue).toHaveBeenCalledWith('webhook.delivery', content, { persistent: true });
    expect(rabbit.sent[0].content).toBe(content);
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
