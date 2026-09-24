/**
 * Component tests for the webhooks HTTP layer.
 *
 * The Elysia app is assembled in-process: real controllers, the real
 * WebhookService and DeliveryService (through the real plugin factories), with
 * the repositories and clients replaced by in-memory fakes. Requests go
 * through app.handle() — no port is bound, nothing is queried over the
 * network (all URLs carry literal IPs, so the SSRF guard never resolves DNS).
 * Update requests always change the URL: the route's response schema declares
 * `secret` optional and the service returns it as undefined when the URL is
 * unchanged. Run with `bun test` from services/webhooks.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createServicesPlugin } from '../src/plugins/services.plugin';
import { createControllersPlugin } from '../src/plugins/controllers.plugin';
import type { RepositoriesPlugin } from '../src/plugins/repositories.plugin';
import type { ClientsPlugin } from '../src/plugins/clients.plugin';
import { createFakeEndpointRepository, type FakeEndpointRepository } from './fakes/endpoint.repository.fake';
import { createFakeDeliveryLogRepository, type FakeDeliveryLogRepository } from './fakes/deliveryLog.repository.fake';
import { createFakeRedisClient, type FakeRedisClient } from './fakes/redis.client.fake';
import { createFakeRabbitMQClient, type FakeRabbitMQClient } from './fakes/rabbitmq.client.fake';
import { createFakeWebhookEventsClient } from './fakes/webhookEvents.client.fake';
import { createFakeWebhookDeliveryClient } from './fakes/webhookDelivery.client.fake';

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const PUBLIC_URL = 'https://8.8.8.8/hooks';

const CREATE_BODY = {
  userId: 'user-1',
  wallet: '0xAbC0000000000000000000000000000000000001',
  url: PUBLIC_URL,
  events: ['pool.created', 'vote.cast'],
};

function buildApp(
  endpoints: FakeEndpointRepository,
  logs: FakeDeliveryLogRepository,
  redis: FakeRedisClient,
  rabbit: FakeRabbitMQClient,
) {
  const repositoriesPlugin = new Elysia({ name: 'Repositories' })
    .decorate('endpointRepository', endpoints)
    .decorate('deliveryLogRepository', logs);

  const clientsPlugin = new Elysia({ name: 'Clients' })
    .decorate('rabbitMQClient', rabbit)
    .decorate('redisClient', redis)
    .decorate('webhookEventsClient', createFakeWebhookEventsClient())
    .decorate('webhookDeliveryClient', createFakeWebhookDeliveryClient());

  const servicesPlugin = createServicesPlugin(
    repositoriesPlugin as unknown as RepositoriesPlugin,
    clientsPlugin as unknown as ClientsPlugin,
    ENCRYPTION_KEY,
  );

  return new Elysia().onError(ErrorHandlerPlugin).use(createControllersPlugin(servicesPlugin));
}

type App = ReturnType<typeof buildApp>;

async function post(app: App, path: string, body: unknown) {
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

  return { status: response.status, body: (await response.json()) as any };
}

describe('webhooks HTTP layer (component, fake repositories and clients)', () => {
  let endpoints: FakeEndpointRepository;
  let logs: FakeDeliveryLogRepository;
  let redis: FakeRedisClient;
  let rabbit: FakeRabbitMQClient;
  let app: App;

  beforeEach(() => {
    endpoints = createFakeEndpointRepository();
    logs = createFakeDeliveryLogRepository();
    redis = createFakeRedisClient();
    rabbit = createFakeRabbitMQClient();
    app = buildApp(endpoints, logs, redis, rabbit);
  });

  test('createEndpoint → getEndpoint → getEndpoints round-trip', async () => {
    const created = await post(app, '/createEndpoint', CREATE_BODY);

    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
      userId: CREATE_BODY.userId,
      wallet: CREATE_BODY.wallet,
      url: PUBLIC_URL,
      events: CREATE_BODY.events,
      description: '',
      active: true,
      rateLimitPerMinute: 100,
    });
    expect(typeof created.body.id).toBe('string');
    expect(created.body.id).toHaveLength(24); // Mongo ObjectId hex
    expect(typeof created.body.secret).toBe('string');
    expect(typeof created.body.createdAt).toBe('number');
    expect(redis.sadd).toHaveBeenCalledWith('webhook:events:pool.created', created.body.id);

    const fetched = await post(app, '/getEndpoint', {
      id: created.body.id,
      userId: CREATE_BODY.userId,
      wallet: CREATE_BODY.wallet,
    });
    expect(fetched.status).toBe(200);
    expect(fetched.body.id).toBe(created.body.id);
    expect(fetched.body.secret).toBeUndefined(); // only create/rotate hand out the secret

    const list = await post(app, '/getEndpoints', { userId: CREATE_BODY.userId, wallet: CREATE_BODY.wallet });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
    expect(list.body[0].secret).toBeUndefined();
  });

  test('createEndpoint: an invalid payload never reaches the repository', async () => {
    const response = await post(app, '/createEndpoint', {
      userId: CREATE_BODY.userId,
      url: PUBLIC_URL,
      events: CREATE_BODY.events,
    }); // wallet is missing

    expect(response.status).not.toBe(200);
    expect(endpoints.createEndpoint).toHaveBeenCalledTimes(0);
  });

  test('createEndpoint: a plain-HTTP URL maps to 400 VALIDATION_ERROR', async () => {
    const response = await post(app, '/createEndpoint', { ...CREATE_BODY, url: 'http://8.8.8.8/hooks' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Only HTTPS URLs are allowed' },
    });
    expect(endpoints.createEndpoint).toHaveBeenCalledTimes(0);
  });

  test('createEndpoint: an SSRF URL maps to 400 VALIDATION_ERROR', async () => {
    const response = await post(app, '/createEndpoint', { ...CREATE_BODY, url: 'https://127.0.0.1/hooks' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'URL points to a private network (SSRF protection)' },
    });
    expect(endpoints.createEndpoint).toHaveBeenCalledTimes(0);
  });

  test('getEndpoint: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/getEndpoint', {
      id: 'unknown-id',
      userId: CREATE_BODY.userId,
      wallet: CREATE_BODY.wallet,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Webhook endpoint unknown-id not found' },
    });
  });

  test('getEndpoints: the user filter is forwarded end-to-end', async () => {
    await post(app, '/createEndpoint', CREATE_BODY);
    await post(app, '/createEndpoint', { ...CREATE_BODY, userId: 'user-2', url: 'https://9.9.9.9/hooks' });

    const list = await post(app, '/getEndpoints', { userId: 'user-1', wallet: CREATE_BODY.wallet });

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].userId).toBe('user-1');
  });

  test('getEndpoints: an unknown user gets an empty array', async () => {
    await post(app, '/createEndpoint', CREATE_BODY);

    const list = await post(app, '/getEndpoints', { userId: 'nobody', wallet: CREATE_BODY.wallet });

    expect(list.status).toBe(200);
    expect(list.body).toEqual([]);
  });

  test('updateEndpoint: a new URL rotates the secret and is visible through getEndpoint', async () => {
    const created = (await post(app, '/createEndpoint', CREATE_BODY)).body;

    const updated = await post(app, '/updateEndpoint', {
      id: created.id,
      userId: CREATE_BODY.userId,
      wallet: CREATE_BODY.wallet,
      url: 'https://9.9.9.9/hooks-v2',
      events: ['pool.created', 'pool.burned'],
    });

    expect(updated.status).toBe(200);
    expect(updated.body.url).toBe('https://9.9.9.9/hooks-v2');
    expect(updated.body.events).toEqual(['pool.created', 'pool.burned']);
    expect(typeof updated.body.secret).toBe('string');
    expect(updated.body.secret).not.toBe(created.secret);

    // The event cache follows the update through the service.
    expect(redis.sadd).toHaveBeenCalledWith('webhook:events:pool.burned', created.id);
    expect(redis.srem).toHaveBeenCalledWith('webhook:events:vote.cast', created.id);

    const fetched = await post(app, '/getEndpoint', {
      id: created.id,
      userId: CREATE_BODY.userId,
      wallet: CREATE_BODY.wallet,
    });
    expect(fetched.body.url).toBe('https://9.9.9.9/hooks-v2');
    expect(fetched.body.events).toEqual(['pool.created', 'pool.burned']);
  });

  test('updateEndpoint: a new URL plus active=false trips the Redis breaker key', async () => {
    const created = (await post(app, '/createEndpoint', CREATE_BODY)).body;

    const updated = await post(app, '/updateEndpoint', {
      id: created.id,
      userId: CREATE_BODY.userId,
      wallet: CREATE_BODY.wallet,
      url: 'https://9.9.9.9/hooks-off',
      active: false,
    });

    expect(updated.status).toBe(200);
    expect(updated.body.active).toBe(false);
    expect(redis.set).toHaveBeenCalledWith(`webhook:endpoint:${created.id}:active`, '0', 'EX', 3600);
  });

  test('updateEndpoint: an invalid URL is rejected before the repository is touched', async () => {
    const created = (await post(app, '/createEndpoint', CREATE_BODY)).body;

    const response = await post(app, '/updateEndpoint', {
      id: created.id,
      userId: CREATE_BODY.userId,
      wallet: CREATE_BODY.wallet,
      url: 'http://8.8.8.8/hooks',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(endpoints.updateEndpoint).toHaveBeenCalledTimes(0);
  });

  test('updateEndpoint: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/updateEndpoint', {
      id: 'unknown-id',
      userId: CREATE_BODY.userId,
      wallet: CREATE_BODY.wallet,
      url: 'https://9.9.9.9/hooks-v2',
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Webhook endpoint unknown-id not found' },
    });
    expect(endpoints.updateEndpoint).toHaveBeenCalledTimes(0);
  });

  test('deleteEndpoint: removes the endpoint and cleans the event cache', async () => {
    const created = (await post(app, '/createEndpoint', CREATE_BODY)).body;

    const deleted = await post(app, '/deleteEndpoint', {
      id: created.id,
      userId: CREATE_BODY.userId,
      wallet: CREATE_BODY.wallet,
    });

    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ id: created.id });
    expect(redis.srem).toHaveBeenCalledWith('webhook:events:pool.created', created.id);
    expect(redis.srem).toHaveBeenCalledWith('webhook:events:vote.cast', created.id);
    expect(redis.del).toHaveBeenCalledWith(`webhook:endpoint:${created.id}:active`);

    const after = await post(app, '/getEndpoint', {
      id: created.id,
      userId: CREATE_BODY.userId,
      wallet: CREATE_BODY.wallet,
    });
    expect(after.status).toBe(404);
  });

  test('deleteEndpoint: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/deleteEndpoint', {
      id: 'unknown-id',
      userId: CREATE_BODY.userId,
      wallet: CREATE_BODY.wallet,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Webhook endpoint unknown-id not found' },
    });
  });
});
