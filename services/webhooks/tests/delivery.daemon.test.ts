/**
 * Unit tests for DeliveryDaemon.
 *
 * Scope: the daemon layer. The daemon is wired to the real DeliveryService with
 * in-memory repositories, a fake Redis client, the fake HTTP client installed
 * on globalThis.fetch and a fake RabbitMQ-backed delivery client
 * (tests/fakes/*.fake.ts). The fake client captures the handler registered
 * through consumeDelivery; tests invoke it with synthetic amqplib-shaped
 * messages and assert the ack/nack/retry decisions and the retry backoff. The
 * retry timer is captured (setTimeout is stubbed) and fired manually — nothing
 * is ever waited on. No database, no broker, no network.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { DeliveryDaemon } from '../src/daemons/delivery.daemon';
import { DeliveryService } from '../src/services/delivery.service';
import type { DeliveryLogRepository } from '../src/repositories/deliveryLog.repository';
import type { EndpointRepository } from '../src/repositories/endpoint.repository';
import type { RedisWithTracing } from '@shared/monitoring/src/redis';
import { createFakeDeliveryLogRepository, type FakeDeliveryLogRepository } from './fakes/deliveryLog.repository.fake';
import { createFakeEndpointRepository, type FakeEndpointRepository } from './fakes/endpoint.repository.fake';
import { createFakeRedisClient, type FakeRedisClient } from './fakes/redis.client.fake';
import {
  createFakeWebhookDeliveryClient,
  type FakeWebhookDeliveryClient,
} from './fakes/webhookDelivery.client.fake';
import { createFakeFetch, type FakeFetch } from './fakes/fetch.fake';
import { createSecretBox, type FakeSecretBox } from './fakes/secrets.fake';
import { createSyntheticMessage } from './fakes/consumerMessage.fake';

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const RAW_SECRET = 'whsec_test_secret';
const HOOK_URL = 'https://8.8.8.8/hooks';
const EVENT_ID = 'evt-1';

type ScheduledTimer = { callback: () => unknown; delayMs: number };

/**
 * Replaces globalThis.setTimeout with a recording stub so the daemon's retry
 * backoff can be asserted and fired deterministically, with no real waiting.
 */
function installFakeTimers() {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'setTimeout');
  const timers: ScheduledTimer[] = [];

  const stub = (callback: () => unknown, delayMs?: number) => {
    timers.push({ callback, delayMs: delayMs ?? 0 });
    return 0 as unknown as ReturnType<typeof setTimeout>;
  };

  Object.defineProperty(globalThis, 'setTimeout', { value: stub, writable: true, configurable: true });

  return {
    timers,
    restore: () => {
      if (descriptor) Object.defineProperty(globalThis, 'setTimeout', descriptor);
      else delete (globalThis as any).setTimeout;
    },
  };
}

describe('DeliveryDaemon (unit, fake clients and repositories)', () => {
  let logs: FakeDeliveryLogRepository;
  let endpoints: FakeEndpointRepository;
  let redis: FakeRedisClient;
  let box: FakeSecretBox;
  let http: FakeFetch;
  let deliveryClient: FakeWebhookDeliveryClient;
  let daemon: DeliveryDaemon;
  let fakeTimers: ReturnType<typeof installFakeTimers>;
  let journal: string[];
  let handler: ((msg: any) => Promise<void>) | null;

  let endpointId: string;
  let deliveryLogId: string;
  let encryptedSecret: string;

  beforeEach(async () => {
    logs = createFakeDeliveryLogRepository();
    endpoints = createFakeEndpointRepository();
    redis = createFakeRedisClient();
    box = createSecretBox(ENCRYPTION_KEY);
    http = createFakeFetch();
    http.install();
    fakeTimers = installFakeTimers();
    journal = [];
    deliveryClient = createFakeWebhookDeliveryClient(journal);

    const deliveryService = new DeliveryService(
      logs as unknown as DeliveryLogRepository,
      endpoints as unknown as EndpointRepository,
      redis as unknown as RedisWithTracing,
      ENCRYPTION_KEY,
    );
    daemon = new DeliveryDaemon(deliveryClient as any, deliveryService);
    await daemon.initialize();
    handler = deliveryClient.getHandler();
    journal.length = 0; // drop the consumeDelivery entry recorded by initialize()

    const created = await endpoints.createEndpoint({
      userId: 'user-1',
      wallet: '0xAbC0000000000000000000000000000000000001',
      url: HOOK_URL,
      secret: 'encrypted-at-rest',
      events: ['pool.created'],
    });
    endpointId = created._id.toString();
    encryptedSecret = box.encrypt(RAW_SECRET);
    deliveryLogId = await deliveryService.createDeliveryLog({
      endpointId,
      eventType: 'pool.created',
      eventId: EVENT_ID,
      payload: { hello: 'world' },
    });
  });

  afterEach(() => {
    fakeTimers.restore();
    http.restore();
  });

  function deliveryMessage(overrides: Record<string, unknown> = {}) {
    return {
      endpointId,
      eventId: EVENT_ID,
      eventType: 'pool.created',
      payload: { hello: 'world' },
      attempt: 0,
      maxAttempts: 3,
      url: HOOK_URL,
      secret: encryptedSecret,
      deliveryLogId,
      ...overrides,
    };
  }

  test('initialize: consumes the delivery queue with manual acknowledgements', async () => {
    expect(deliveryClient.consumeDelivery).toHaveBeenCalledTimes(1);
    expect(typeof deliveryClient.getHandler()).toBe('function');
  });

  test('handler: acks after a successful delivery', async () => {
    http.setResponse({ status: 200, body: 'ok' });
    const message = deliveryMessage();

    await handler!(createSyntheticMessage(message, { exchange: 'webhooks.dlq' }));

    expect(deliveryClient.ackMessage).toHaveBeenCalledTimes(1);
    expect(deliveryClient.nackMessage).toHaveBeenCalledTimes(0);
    expect(deliveryClient.sendToDeliveryQueue).toHaveBeenCalledTimes(0);
    expect(fakeTimers.timers).toHaveLength(0);
    expect(journal).toEqual(['ackMessage']);

    expect(http.calls).toHaveLength(1);
    expect(http.calls[0].url).toBe(HOOK_URL);
    expect(http.calls[0].init.headers['X-Webhook-Id']).toBe(EVENT_ID);
    expect(http.calls[0].init.body).toBe(JSON.stringify(message.payload));
    expect(logs.updateStatus).toHaveBeenCalledWith(deliveryLogId, { status: 'delivered' });
  });

  test('handler: nacks without requeue when the delivery is dead-lettered', async () => {
    http.setResponse({ status: 404, body: 'gone' });
    const message = createSyntheticMessage(deliveryMessage());

    await handler!(message);

    expect(deliveryClient.nackedMessages).toHaveLength(1);
    expect(deliveryClient.nackedMessages[0].message).toBe(message);
    expect(deliveryClient.nackedMessages[0].requeue).toBe(false);
    expect(deliveryClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(fakeTimers.timers).toHaveLength(0);
    expect(journal).toEqual(['nackMessage']);
  });

  test('handler: acks the current message and schedules the re-enqueue on retry', async () => {
    http.setResponse({ status: 500, body: 'boom' });
    const message = deliveryMessage();

    await handler!(createSyntheticMessage(message));

    expect(deliveryClient.ackMessage).toHaveBeenCalledTimes(1);
    expect(deliveryClient.nackMessage).toHaveBeenCalledTimes(0);
    expect(deliveryClient.sendToDeliveryQueue).toHaveBeenCalledTimes(0); // only after the timer fires
    expect(fakeTimers.timers).toHaveLength(1);

    const timer = fakeTimers.timers[0];
    // 1000 * 2^attempt + up to 250 ms of jitter, computed from the incoming attempt.
    expect(timer.delayMs).toBeGreaterThanOrEqual(1000);
    expect(timer.delayMs).toBeLessThanOrEqual(1250);
    expect(journal).toEqual(['ackMessage']);

    await timer.callback();

    expect(deliveryClient.sendToDeliveryQueue).toHaveBeenCalledTimes(1);
    // The retried message is the original with the attempt incremented once.
    expect(deliveryClient.sentMessages[0]).toEqual({ ...message, attempt: 1 });
    expect(journal).toEqual(['ackMessage', 'sendToDeliveryQueue']);
  });

  for (const { attempt, min, max } of [
    { attempt: 1, min: 2000, max: 2250 },
    { attempt: 3, min: 8000, max: 8250 },
    { attempt: 10, min: 128000, max: 128000 }, // capped by Math.min(..., 128000)
  ]) {
    test(`handler: retry backoff for attempt ${attempt} is ${min}-${max}ms`, async () => {
      http.setResponse({ status: 500, body: 'boom' });

      await handler!(createSyntheticMessage(deliveryMessage({ attempt, maxAttempts: attempt + 2 })));

      expect(fakeTimers.timers).toHaveLength(1);
      expect(fakeTimers.timers[0].delayMs).toBeGreaterThanOrEqual(min);
      expect(fakeTimers.timers[0].delayMs).toBeLessThanOrEqual(max);
    });
  }

  test('handler: forwards the incremented attempt, so the boundary is evaluated on attempt+1', async () => {
    http.setResponse({ status: 500, body: 'boom' });
    // Incoming attempt 0 with maxAttempts 1 → the service sees attempt 1 and
    // must dead-letter immediately instead of scheduling a retry.
    const message = createSyntheticMessage(deliveryMessage({ attempt: 0, maxAttempts: 1 }));

    await handler!(message);

    expect(deliveryClient.nackedMessages).toHaveLength(1);
    expect(deliveryClient.nackedMessages[0].message).toBe(message);
    expect(deliveryClient.nackedMessages[0].requeue).toBe(false);
    expect(deliveryClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(fakeTimers.timers).toHaveLength(0);
    expect(logs.updateStatus).toHaveBeenCalledWith(deliveryLogId, { status: 'dead_letter' });
  });

  test('handler: dead-letters an oversized payload', async () => {
    http.setResponse({ status: 200 });
    const message = createSyntheticMessage(deliveryMessage({ payload: { blob: 'x'.repeat(256 * 1024) + 'x' } }));

    await handler!(message);

    expect(http.calls).toHaveLength(0);
    expect(deliveryClient.nackedMessages).toHaveLength(1);
    expect(deliveryClient.nackedMessages[0].message).toBe(message);
    expect(deliveryClient.nackedMessages[0].requeue).toBe(false);
    expect(deliveryClient.ackMessage).toHaveBeenCalledTimes(0);
  });

  test('handler: ignores a null delivery', async () => {
    await handler!(null);

    expect(deliveryClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(deliveryClient.nackMessage).toHaveBeenCalledTimes(0);
    expect(fakeTimers.timers).toHaveLength(0);
  });

  test('handler: nacks without requeue when the content is not valid JSON', async () => {
    const message = createSyntheticMessage('not-json');

    await handler!(message);

    expect(deliveryClient.nackedMessages).toHaveLength(1);
    expect(deliveryClient.nackedMessages[0].message).toBe(message);
    expect(deliveryClient.nackedMessages[0].requeue).toBe(false);
    expect(deliveryClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(fakeTimers.timers).toHaveLength(0);
  });

  test('handler: nacks without requeue when the delivery service throws', async () => {
    http.setResponse({ status: 200 });
    // The service records the outcome through the log repository; a failure
    // there propagates out of its own catch block and reaches the daemon.
    logs.pushAttempt.mockImplementation(async () => {
      throw new Error('mongo down');
    });

    const message = createSyntheticMessage(deliveryMessage());

    await handler!(message);

    expect(deliveryClient.nackedMessages).toHaveLength(1);
    expect(deliveryClient.nackedMessages[0].message).toBe(message);
    expect(deliveryClient.nackedMessages[0].requeue).toBe(false);
    expect(deliveryClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(fakeTimers.timers).toHaveLength(0);
    expect(journal).toEqual(['nackMessage']);
  });
});
