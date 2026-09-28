/**
 * Unit tests for DeliveryDaemon.
 *
 * Scope: the daemon layer. The daemon is wired to the real DeliveryService with
 * in-memory repositories, a fake Redis client, the fake HTTP client installed
 * on globalThis.fetch and a fake RabbitMQ-backed delivery client
 * (tests/fakes/*.fake.ts). The fake client captures the handler registered
 * through consumeDelivery; tests invoke it with synthetic amqplib-shaped
 * messages and assert the ack/nack/retry decisions. Retries are parked in
 * RabbitMQ retry buckets (no in-process timers), so there is nothing to wait
 * on: nothing is ever scheduled in this process. No database, no broker, no
 * network.
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

const RAW_SECRET = `whsec_${Buffer.alloc(32, 9).toString('base64')}`;
const HOOK_URL = 'https://8.8.8.8/hooks';
const EVENT_ID = 'evt-1';

describe('DeliveryDaemon (unit, fake clients and repositories)', () => {
  let logs: FakeDeliveryLogRepository;
  let endpoints: FakeEndpointRepository;
  let redis: FakeRedisClient;
  let box: FakeSecretBox;
  let http: FakeFetch;
  let deliveryClient: FakeWebhookDeliveryClient;
  let daemon: DeliveryDaemon;
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
      events: ['pool.deployed'],
    });
    endpointId = created._id.toString();
    encryptedSecret = box.encrypt(RAW_SECRET);
    deliveryLogId = await deliveryService.createDeliveryLog({
      endpointId,
      eventType: 'pool.deployed',
      eventId: EVENT_ID,
      payload: { hello: 'world' },
    });
  });

  afterEach(() => {
    http.restore();
  });

  function deliveryMessage(overrides: Record<string, unknown> = {}) {
    return {
      endpointId,
      eventId: EVENT_ID,
      eventType: 'pool.deployed',
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
    expect(deliveryClient.sendToRetryQueue).toHaveBeenCalledTimes(0);
    expect(journal).toEqual(['ackMessage']);

    expect(http.calls).toHaveLength(1);
    expect(http.calls[0].url).toBe(HOOK_URL);
    // Standard Webhooks headers: the id is the receiver's deduplication key.
    expect(http.calls[0].init.headers['webhook-id']).toBe(EVENT_ID);
    expect(http.calls[0].init.headers['webhook-event']).toBe('pool.deployed');
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
    expect(deliveryClient.sendToRetryQueue).toHaveBeenCalledTimes(0);
    expect(logs.updateStatus).toHaveBeenCalledWith(deliveryLogId, { status: 'dead_letter' });
    expect(journal).toEqual(['nackMessage']);
  });

  test('handler: parks the retry in a broker bucket, then acks — in that order', async () => {
    http.setResponse({ status: 500, body: 'boom' });
    const message = deliveryMessage();

    await handler!(createSyntheticMessage(message));

    // No in-process timer: the message is republished into the retry bucket
    // selected by the incoming attempt, the original one is acked afterwards.
    expect(deliveryClient.retriedMessages).toHaveLength(1);
    expect(deliveryClient.retriedMessages[0].attempt).toBe(0);
    expect(deliveryClient.retriedMessages[0].content).toEqual({ ...message, attempt: 1 });
    expect(deliveryClient.ackMessage).toHaveBeenCalledTimes(1);
    expect(deliveryClient.nackMessage).toHaveBeenCalledTimes(0);
    expect(deliveryClient.sendToDeliveryQueue).toHaveBeenCalledTimes(0);
    expect(journal).toEqual(['sendToRetryQueue', 'ackMessage']);
  });

  test('handler: requeues the original message when the retry cannot be scheduled', async () => {
    http.setResponse({ status: 500, body: 'boom' });
    deliveryClient.sendToRetryQueue.mockImplementationOnce(async () => {
      throw new Error('rabbit down');
    });
    const message = createSyntheticMessage(deliveryMessage());

    await handler!(message);

    // Nothing was acked: the broker will redeliver this very message.
    expect(deliveryClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(deliveryClient.nackedMessages).toHaveLength(1);
    expect(deliveryClient.nackedMessages[0].message).toBe(message);
    expect(deliveryClient.nackedMessages[0].requeue).toBe(true);
  });

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
    expect(deliveryClient.sendToRetryQueue).toHaveBeenCalledTimes(0);
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
    expect(logs.updateStatus).toHaveBeenCalledWith(deliveryLogId, { status: 'dead_letter' });
  });

  test('handler: ignores a null delivery', async () => {
    await handler!(null);

    expect(deliveryClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(deliveryClient.nackMessage).toHaveBeenCalledTimes(0);
    expect(deliveryClient.sendToRetryQueue).toHaveBeenCalledTimes(0);
  });

  test('handler: nacks without requeue when the content is not valid JSON', async () => {
    const message = createSyntheticMessage('not-json');

    await handler!(message);

    expect(deliveryClient.nackedMessages).toHaveLength(1);
    expect(deliveryClient.nackedMessages[0].message).toBe(message);
    expect(deliveryClient.nackedMessages[0].requeue).toBe(false);
    expect(deliveryClient.ackMessage).toHaveBeenCalledTimes(0);
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
    expect(journal).toEqual(['nackMessage']);
  });
});
