/**
 * Unit tests for WebhookEventsDaemon.
 *
 * Scope: the daemon layer. The daemon is wired to the real WebhookService and
 * DeliveryService with in-memory repositories, a fake Redis client and fake
 * RabbitMQ-backed clients (tests/fakes/*.fake.ts). The fake events client
 * captures the handler registered through consumeEvents; tests invoke it with
 * synthetic amqplib-shaped messages (content Buffer, fields, redelivered) and
 * assert the resulting ack/nack decisions. No database, no broker, no network.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { WebhookEventsDaemon } from '../src/daemons/webhookEvents.daemon';
import { WebhookService } from '../src/services/webhook.service';
import { DeliveryService } from '../src/services/delivery.service';
import type { EndpointRepository } from '../src/repositories/endpoint.repository';
import type { DeliveryLogRepository } from '../src/repositories/deliveryLog.repository';
import type { RedisWithTracing } from '@shared/monitoring/src/redis';
import { createFakeEndpointRepository, type FakeEndpointRepository } from './fakes/endpoint.repository.fake';
import { createFakeDeliveryLogRepository, type FakeDeliveryLogRepository } from './fakes/deliveryLog.repository.fake';
import { createFakeRedisClient, type FakeRedisClient } from './fakes/redis.client.fake';
import {
  createFakeWebhookEventsClient,
  type FakeWebhookEventsClient,
} from './fakes/webhookEvents.client.fake';
import {
  createFakeWebhookDeliveryClient,
  type FakeWebhookDeliveryClient,
} from './fakes/webhookDelivery.client.fake';
import { createSyntheticMessage } from './fakes/consumerMessage.fake';

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const EVENT = {
  id: 'evt-1',
  type: 'pool.created',
  timestamp: 1766000000000,
  payload: { poolId: 'pool-1', amount: '100' },
};

describe('WebhookEventsDaemon (unit, fake clients and repositories)', () => {
  let endpoints: FakeEndpointRepository;
  let logs: FakeDeliveryLogRepository;
  let redis: FakeRedisClient;
  let eventsClient: FakeWebhookEventsClient;
  let deliveryClient: FakeWebhookDeliveryClient;
  let daemon: WebhookEventsDaemon;
  let journal: string[];
  let handler: ((msg: any) => Promise<void>) | null;

  beforeEach(async () => {
    endpoints = createFakeEndpointRepository();
    logs = createFakeDeliveryLogRepository();
    redis = createFakeRedisClient();
    journal = [];
    eventsClient = createFakeWebhookEventsClient(journal);
    deliveryClient = createFakeWebhookDeliveryClient(journal);

    const webhookService = new WebhookService(
      endpoints as unknown as EndpointRepository,
      redis as unknown as RedisWithTracing,
      ENCRYPTION_KEY,
    );
    const deliveryService = new DeliveryService(
      logs as unknown as DeliveryLogRepository,
      endpoints as unknown as EndpointRepository,
      redis as unknown as RedisWithTracing,
      ENCRYPTION_KEY,
    );

    daemon = new WebhookEventsDaemon(eventsClient as any, deliveryClient as any, webhookService, deliveryService);
    await daemon.initialize();
    handler = eventsClient.getHandler();
    journal.length = 0; // drop the consumeEvents entry recorded by initialize()
  });

  async function seedEndpoint(overrides: Record<string, unknown> = {}) {
    const created = await endpoints.createEndpoint({
      userId: 'user-1',
      wallet: '0xAbC0000000000000000000000000000000000001',
      url: 'https://8.8.8.8/hooks',
      secret: 'encrypted-at-rest',
      events: ['pool.created'],
    });
    Object.assign(created as any, overrides);
    return created;
  }

  test('initialize: consumes the events queue with manual acknowledgements', async () => {
    expect(eventsClient.consumeEvents).toHaveBeenCalledTimes(1);
    expect(typeof eventsClient.getHandler()).toBe('function');
  });

  test('handler: acks an event that no endpoint subscribes to', async () => {
    await seedEndpoint({ events: ['vote.cast'] });

    const message = createSyntheticMessage(EVENT);
    await handler!(message);

    expect(endpoints.findByEvents).toHaveBeenCalledWith('pool.created');
    expect(eventsClient.ackMessage).toHaveBeenCalledWith(message);
    expect(eventsClient.nackMessage).toHaveBeenCalledTimes(0);
    expect(logs.createDeliveryLog).toHaveBeenCalledTimes(0);
    expect(deliveryClient.sendToDeliveryQueue).toHaveBeenCalledTimes(0);
  });

  test('handler: enqueues one delivery per active subscriber and acks the event', async () => {
    const first = await seedEndpoint({ userId: 'user-1' });
    const second = await seedEndpoint({ userId: 'user-2', url: 'https://9.9.9.9/hooks', secret: 'encrypted-second' });

    const message = createSyntheticMessage(EVENT);
    await handler!(message);

    expect(redis.smembers).toHaveBeenCalledWith('webhook:events:pool.created');
    expect(logs.createDeliveryLog).toHaveBeenCalledTimes(2);
    expect(deliveryClient.sendToDeliveryQueue).toHaveBeenCalledTimes(2);

    const sent = deliveryClient.sentMessages;
    expect(sent.map((entry) => entry.endpointId)).toEqual([first._id.toString(), second._id.toString()]);
    for (const entry of sent) {
      expect(entry.eventId).toBe(EVENT.id);
      expect(entry.eventType).toBe(EVENT.type);
      expect(entry.payload).toEqual(EVENT.payload);
      expect(entry.attempt).toBe(0); // first delivery attempt
      expect(entry.maxAttempts).toBe(8); // model default
      expect(typeof entry.deliveryLogId).toBe('string');
      // Every enqueued delivery has a pending log of its own.
      expect(logs.store.get(entry.deliveryLogId)!.status).toBe('pending');
      expect(logs.store.get(entry.deliveryLogId)!.endpointId.toString()).toBe(entry.endpointId);
    }
    expect(sent[0].url).toBe('https://8.8.8.8/hooks');
    expect(sent[0].secret).toBe('encrypted-at-rest');

    expect(eventsClient.ackedMessages).toHaveLength(1);
    expect(eventsClient.ackedMessages[0]).toBe(message);
    expect(eventsClient.nackMessage).toHaveBeenCalledTimes(0);
    // The event is acked only after every delivery has been enqueued.
    expect(journal).toEqual(['sendToDeliveryQueue', 'sendToDeliveryQueue', 'ackMessage']);
  });

  test('handler: skips an endpoint whose breaker key is set in Redis but still acks', async () => {
    const endpoint = await seedEndpoint();
    await redis.set(`webhook:endpoint:${endpoint._id.toString()}:active`, '0');

    const message = createSyntheticMessage(EVENT);
    await handler!(message);

    expect(logs.createDeliveryLog).toHaveBeenCalledTimes(0);
    expect(deliveryClient.sendToDeliveryQueue).toHaveBeenCalledTimes(0);
    expect(eventsClient.ackMessage).toHaveBeenCalledTimes(1);
  });

  test('handler: skips an endpoint deactivated after the subscription lookup', async () => {
    // findByEvents filters active:true, so the race where an endpoint is
    // deactivated between the lookup and the breaker check is simulated by
    // returning the now-inactive document straight from the fake.
    const endpoint = await seedEndpoint({ active: false });
    endpoints.findByEvents.mockImplementationOnce(async () => [endpoint]);

    const message = createSyntheticMessage(EVENT);
    await handler!(message);

    expect(logs.createDeliveryLog).toHaveBeenCalledTimes(0);
    expect(deliveryClient.sendToDeliveryQueue).toHaveBeenCalledTimes(0);
    expect(eventsClient.ackMessage).toHaveBeenCalledTimes(1);
  });

  test('handler: still delivers when the Redis index is unavailable', async () => {
    await seedEndpoint();
    redis.smembers.mockImplementationOnce(async () => {
      throw new Error('redis down');
    });

    const message = createSyntheticMessage(EVENT);
    await handler!(message);

    expect(endpoints.findByEvents).toHaveBeenCalledTimes(1);
    expect(deliveryClient.sendToDeliveryQueue).toHaveBeenCalledTimes(1);
    expect(eventsClient.ackMessage).toHaveBeenCalledTimes(1);
  });

  test('handler: skips an endpoint that exceeded its rate limit', async () => {
    const endpoint = await seedEndpoint({ rateLimitPerMinute: 10 });
    const rateLimitKey = `webhook:endpoint:${endpoint._id.toString()}:rl`;
    await redis.set(rateLimitKey, '10'); // the next incr is hit 11 > limit 10

    const message = createSyntheticMessage(EVENT);
    await handler!(message);

    expect(redis.incr).toHaveBeenCalledWith(rateLimitKey);
    expect(redis.expire).toHaveBeenCalledTimes(0); // TTL is only set on the first hit of a window
    expect(logs.createDeliveryLog).toHaveBeenCalledTimes(0);
    expect(deliveryClient.sendToDeliveryQueue).toHaveBeenCalledTimes(0);
    expect(eventsClient.ackMessage).toHaveBeenCalledTimes(1);
  });

  test('handler: delivers when Redis rate limiting fails open', async () => {
    await seedEndpoint();
    redis.incr.mockImplementationOnce(async () => {
      throw new Error('redis down');
    });

    const message = createSyntheticMessage(EVENT);
    await handler!(message);

    expect(deliveryClient.sendToDeliveryQueue).toHaveBeenCalledTimes(1);
    expect(eventsClient.ackMessage).toHaveBeenCalledTimes(1);
  });

  test('handler: ignores a null delivery', async () => {
    await handler!(null);

    expect(eventsClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(eventsClient.nackMessage).toHaveBeenCalledTimes(0);
    expect(logs.createDeliveryLog).toHaveBeenCalledTimes(0);
  });

  test('handler: nacks without requeue when the content is not valid JSON', async () => {
    const message = createSyntheticMessage('{not json');

    await handler!(message);

    expect(eventsClient.nackedMessages).toHaveLength(1);
    expect(eventsClient.nackedMessages[0].message).toBe(message);
    expect(eventsClient.nackedMessages[0].requeue).toBe(false);
    expect(eventsClient.ackMessage).toHaveBeenCalledTimes(0);
  });

  test('handler: nacks without requeue when the event cannot be processed', async () => {
    redis.status = 'end'; // bypass the Redis cache read
    endpoints.findByEvents.mockImplementationOnce(async () => {
      throw new Error('mongo down');
    });

    const message = createSyntheticMessage(EVENT);
    await handler!(message);

    expect(eventsClient.nackedMessages).toHaveLength(1);
    expect(eventsClient.nackedMessages[0].message).toBe(message);
    expect(eventsClient.nackedMessages[0].requeue).toBe(false);
    expect(eventsClient.ackMessage).toHaveBeenCalledTimes(0);
  });

  test('handler: oversized events are still enqueued (the daemon only warns)', async () => {
    await seedEndpoint();

    // Faithful to src: the size check logs 'truncating' but does not truncate
    // or reject — the delivery is created and the DeliveryService later
    // dead-letters it (see the delivery.service tests).
    const payload = { blob: 'x'.repeat(256 * 1024) + 'x' };
    const message = createSyntheticMessage({ ...EVENT, payload });
    await handler!(message);

    expect(logs.createDeliveryLog).toHaveBeenCalledTimes(1);
    expect(deliveryClient.sendToDeliveryQueue).toHaveBeenCalledTimes(1);
    expect(deliveryClient.sentMessages[0].payload).toEqual(payload);
    expect(eventsClient.ackMessage).toHaveBeenCalledTimes(1);
  });
});
