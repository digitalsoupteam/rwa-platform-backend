/**
 * Unit tests for WebhookService.
 *
 * Scope: the service layer only. The endpoint repository and the Redis client
 * are replaced with in-memory fakes (tests/fakes/*.fake.ts), so these tests
 * need no database, no broker and no network. `validateUrl` resolves hostnames
 * through node:dns, so every URL used here carries a literal IP address — the
 * DNS-free path of the SSRF guard. Run with `bun test` from services/webhooks.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { WebhookService } from '../src/services/webhook.service';
import type { EndpointRepository } from '../src/repositories/endpoint.repository';
import type { RedisWithTracing } from '@shared/monitoring/src/redis';
import { createFakeEndpointRepository, type FakeEndpointRepository } from './fakes/endpoint.repository.fake';
import { createFakeRedisClient, type FakeRedisClient } from './fakes/redis.client.fake';
import { createSecretBox, type FakeSecretBox } from './fakes/secrets.fake';

// 32-byte AES-256-GCM key, computed here so the value is not hand-encoded.
const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

// Literal public IP: the SSRF guard takes the isIP() path and never resolves DNS.
const PUBLIC_URL = 'https://8.8.8.8/hooks';

const ENDPOINT = {
  userId: 'user-1',
  wallet: '0xAbC0000000000000000000000000000000000001',
  url: PUBLIC_URL,
  events: ['pool.created', 'vote.cast'],
};

// Every one of these must trip the private-address check in validateUrl.
const BLOCKED_URLS = [
  'https://127.0.0.1/hooks', // loopback
  'https://10.1.2.3/hooks', // 10.0.0.0/8
  'https://172.16.5.5/hooks', // 172.16.0.0/12
  'https://192.168.1.10/hooks', // 192.168.0.0/16
  'https://100.64.0.1/hooks', // CGNAT
  'https://169.254.169.254/latest/meta-data', // link-local / cloud metadata
  'https://0.0.0.0/hooks', // unspecified
  'https://224.0.0.1/hooks', // multicast
  'https://[::1]/hooks', // IPv6 loopback
  'https://[fd12:3456::1]/hooks', // IPv6 unique local
  'https://[fe80::1]/hooks', // IPv6 link-local
  'https://[::ffff:127.0.0.1]/hooks', // IPv4-mapped loopback
];

describe('WebhookService (unit, fake repositories)', () => {
  let endpoints: FakeEndpointRepository;
  let redis: FakeRedisClient;
  let box: FakeSecretBox;
  let service: WebhookService;

  beforeEach(() => {
    endpoints = createFakeEndpointRepository();
    redis = createFakeRedisClient();
    box = createSecretBox(ENCRYPTION_KEY);
    service = new WebhookService(
      endpoints as unknown as EndpointRepository,
      redis as unknown as RedisWithTracing,
      ENCRYPTION_KEY,
    );
  });

  test('createEndpoint: stores an encrypted secret, returns the raw one and fills the cache', async () => {
    const created = await service.createEndpoint(ENDPOINT);

    expect(endpoints.countByUser).toHaveBeenCalledWith('user-1');
    expect(endpoints.createEndpoint).toHaveBeenCalledTimes(1);
    expect(endpoints.createEndpoint).toHaveBeenCalledWith({
      userId: ENDPOINT.userId,
      wallet: ENDPOINT.wallet,
      url: ENDPOINT.url,
      secret: expect.any(String),
      events: ENDPOINT.events,
      description: '',
      rateLimitPerMinute: 100,
    });

    // The caller gets the raw secret; the store holds it encrypted with the
    // service key only.
    const stored = endpoints.store.get(created.id)!;
    expect(created.secret).toEqual(expect.any(String));
    expect(stored.secret).not.toBe(created.secret);
    expect(box.decrypt(stored.secret)).toBe(created.secret);

    expect(created).toMatchObject({
      userId: ENDPOINT.userId,
      wallet: ENDPOINT.wallet,
      url: ENDPOINT.url,
      events: ENDPOINT.events,
      description: '',
      active: true,
      rateLimitPerMinute: 100,
    });
    expect(created).not.toHaveProperty('_id');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(created))).toEqual(created);

    expect(redis.sadd).toHaveBeenCalledTimes(2);
    expect(redis.sadd).toHaveBeenCalledWith('webhook:events:pool.created', created.id);
    expect(redis.sadd).toHaveBeenCalledWith('webhook:events:vote.cast', created.id);
  });

  test('createEndpoint: honours an explicit description and rate limit', async () => {
    const created = await service.createEndpoint({ ...ENDPOINT, description: 'Order fills', rateLimitPerMinute: 5 });

    const stored = endpoints.store.get(created.id)!;
    expect(stored.description).toBe('Order fills');
    expect(stored.rateLimitPerMinute).toBe(5);
  });

  test('createEndpoint: falsy description/rateLimitPerMinute fall back to the defaults', async () => {
    // Faithful to src: `data.description || ''` and `data.rateLimitPerMinute || 100`
    // mean an explicit 0 is stored as 100.
    const created = await service.createEndpoint({ ...ENDPOINT, description: '', rateLimitPerMinute: 0 });

    const stored = endpoints.store.get(created.id)!;
    expect(stored.rateLimitPerMinute).toBe(100);
    expect(stored.description).toBe('');
  });

  test('createEndpoint: rejects a non-HTTPS URL before touching the repository', async () => {
    await expect(service.createEndpoint({ ...ENDPOINT, url: 'http://8.8.8.8/hooks' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Only HTTPS URLs are allowed',
    });

    expect(endpoints.countByUser).toHaveBeenCalledTimes(0);
    expect(endpoints.createEndpoint).toHaveBeenCalledTimes(0);
    expect(redis.sadd).toHaveBeenCalledTimes(0);
  });

  test('createEndpoint: rejects a malformed URL', async () => {
    await expect(service.createEndpoint({ ...ENDPOINT, url: 'not a url' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid URL format',
    });

    expect(endpoints.createEndpoint).toHaveBeenCalledTimes(0);
  });

  test('createEndpoint: rejects a URL longer than 2048 characters', async () => {
    const url = `https://8.8.8.8/${'a'.repeat(2048)}`;

    await expect(service.createEndpoint({ ...ENDPOINT, url })).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'URL exceeds maximum length of 2048 characters',
    });

    expect(endpoints.createEndpoint).toHaveBeenCalledTimes(0);
  });

  for (const url of BLOCKED_URLS) {
    test(`createEndpoint: blocks the SSRF target ${url}`, async () => {
      await expect(service.createEndpoint({ ...ENDPOINT, url })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'URL points to a private network (SSRF protection)',
      });

      expect(endpoints.countByUser).toHaveBeenCalledTimes(0);
      expect(endpoints.createEndpoint).toHaveBeenCalledTimes(0);
    });
  }

  test('createEndpoint: enforces the 50-endpoint limit per user', async () => {
    for (let index = 0; index < 50; index++) {
      await service.createEndpoint({ ...ENDPOINT, url: `${PUBLIC_URL}/${index}` });
    }
    endpoints.createEndpoint.mockClear();
    redis.sadd.mockClear();

    await expect(service.createEndpoint({ ...ENDPOINT, url: `${PUBLIC_URL}/one-more` })).rejects.toMatchObject({
      statusCode: 400,
      code: 'LIMIT_EXCEEDED',
      message: 'Maximum 50 webhook endpoints per user',
    });

    expect(endpoints.createEndpoint).toHaveBeenCalledTimes(0);
    expect(redis.sadd).toHaveBeenCalledTimes(0);
  });

  test('getEndpoints: forwards the user filter and never returns the stored secret', async () => {
    const mine = await service.createEndpoint(ENDPOINT);
    await service.createEndpoint({ ...ENDPOINT, userId: 'user-2', url: `${PUBLIC_URL}/other` });

    const list = await service.getEndpoints({ userId: 'user-1', wallet: ENDPOINT.wallet });

    expect(endpoints.findAll).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(mine.id);
    expect(list[0].url).toBe(PUBLIC_URL);
    expect(list[0]).not.toHaveProperty('secret');
    expect(JSON.parse(JSON.stringify(list[0]))).toEqual(list[0]);
  });

  test('getEndpoints: returns an empty array when the user has no endpoints', async () => {
    await service.createEndpoint(ENDPOINT);

    const list = await service.getEndpoints({ userId: 'nobody', wallet: ENDPOINT.wallet });

    expect(list).toEqual([]);
  });

  test('getEndpoint: returns the mapped endpoint', async () => {
    const created = await service.createEndpoint(ENDPOINT);

    const found = await service.getEndpoint({ id: created.id, userId: ENDPOINT.userId, wallet: ENDPOINT.wallet });

    expect(endpoints.findById).toHaveBeenCalledWith(created.id);
    expect(found.id).toBe(created.id);
    expect(found.url).toBe(PUBLIC_URL);
    expect(found).not.toHaveProperty('secret');
  });

  test('getEndpoint: propagates NOT_FOUND for an unknown id', async () => {
    await expect(
      service.getEndpoint({ id: 'unknown-id', userId: ENDPOINT.userId, wallet: ENDPOINT.wallet }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  test('updateEndpoint: forwards only the mutable fields — id/userId/wallet are stripped', async () => {
    const created = await service.createEndpoint(ENDPOINT);

    const updated = await service.updateEndpoint({
      id: created.id,
      userId: ENDPOINT.userId,
      wallet: ENDPOINT.wallet,
      description: 'Updated',
      active: false,
      rateLimitPerMinute: 42,
      events: ['pool.created'],
    });

    expect(endpoints.updateEndpoint).toHaveBeenCalledTimes(1);
    const [id, updateData] = endpoints.updateEndpoint.mock.calls[0] as [string, any];
    expect(id).toBe(created.id);
    expect(updateData).toEqual({
      description: 'Updated',
      active: false,
      rateLimitPerMinute: 42,
      events: ['pool.created'],
    });
    expect(updated.description).toBe('Updated');
    expect(updated.active).toBe(false);
    expect(updated.rateLimitPerMinute).toBe(42);
  });

  test('updateEndpoint: rotates the secret when the URL changes', async () => {
    const created = await service.createEndpoint(ENDPOINT);
    const newUrl = 'https://9.9.9.9/new-hook';

    const updated = await service.updateEndpoint({
      id: created.id,
      userId: ENDPOINT.userId,
      wallet: ENDPOINT.wallet,
      url: newUrl,
    });

    const [, updateData] = endpoints.updateEndpoint.mock.calls[0] as [string, any];
    expect(updateData.url).toBe(newUrl);
    expect(updateData.secret).toEqual(expect.any(String));
    // The stored value is the encrypted form of the secret returned to the caller.
    expect(endpoints.store.get(created.id)!.secret).toBe(updateData.secret);
    expect(box.decrypt(updateData.secret)).toBe(updated.secret);
    expect(updated.secret).not.toBe(created.secret);
    expect(updated.url).toBe(newUrl);
  });

  test('updateEndpoint: keeps the secret when the URL is unchanged', async () => {
    const created = await service.createEndpoint(ENDPOINT);
    const secretBefore = endpoints.store.get(created.id)!.secret;

    const updated = await service.updateEndpoint({
      id: created.id,
      userId: ENDPOINT.userId,
      wallet: ENDPOINT.wallet,
      url: PUBLIC_URL,
      events: ['pool.created'],
    });

    const [, updateData] = endpoints.updateEndpoint.mock.calls[0] as [string, any];
    expect(updateData).not.toHaveProperty('secret');
    expect(updated.secret).toBeUndefined();
    expect(endpoints.store.get(created.id)!.secret).toBe(secretBefore);
  });

  test('updateEndpoint: validates a new URL before persisting', async () => {
    const created = await service.createEndpoint(ENDPOINT);

    await expect(
      service.updateEndpoint({
        id: created.id,
        userId: ENDPOINT.userId,
        wallet: ENDPOINT.wallet,
        url: 'http://8.8.8.8/hooks',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });

    expect(endpoints.findById).toHaveBeenCalledWith(created.id); // the lookup happens first
    expect(endpoints.updateEndpoint).toHaveBeenCalledTimes(0);
  });

  test('updateEndpoint: propagates NOT_FOUND for an unknown id', async () => {
    await expect(
      service.updateEndpoint({ id: 'unknown-id', userId: ENDPOINT.userId, wallet: ENDPOINT.wallet }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

    expect(endpoints.updateEndpoint).toHaveBeenCalledTimes(0);
  });

  test('updateEndpoint: syncs the event cache — sadd for added, srem for removed events', async () => {
    const created = await service.createEndpoint(ENDPOINT); // pool.created, vote.cast
    redis.sadd.mockClear();
    redis.srem.mockClear();

    await service.updateEndpoint({
      id: created.id,
      userId: ENDPOINT.userId,
      wallet: ENDPOINT.wallet,
      events: ['pool.created', 'pool.burned'],
    });

    expect(redis.sadd).toHaveBeenCalledTimes(1);
    expect(redis.sadd).toHaveBeenCalledWith('webhook:events:pool.burned', created.id);
    expect(redis.srem).toHaveBeenCalledTimes(1);
    expect(redis.srem).toHaveBeenCalledWith('webhook:events:vote.cast', created.id);
    expect(endpoints.store.get(created.id)!.events).toEqual(['pool.created', 'pool.burned']);
  });

  test('updateEndpoint: toggling active caches the circuit breaker in Redis', async () => {
    const created = await service.createEndpoint(ENDPOINT);
    const activeKey = `webhook:endpoint:${created.id}:active`;

    const deactivated = await service.updateEndpoint({
      id: created.id,
      userId: ENDPOINT.userId,
      wallet: ENDPOINT.wallet,
      active: false,
    });
    expect(deactivated.active).toBe(false);
    expect(redis.set).toHaveBeenCalledWith(activeKey, '0', 'EX', 3600);

    const reactivated = await service.updateEndpoint({
      id: created.id,
      userId: ENDPOINT.userId,
      wallet: ENDPOINT.wallet,
      active: true,
    });
    expect(reactivated.active).toBe(true);
    expect(redis.del).toHaveBeenCalledWith(activeKey);
  });

  test('deleteEndpoint: removes the endpoint, its event entries and the breaker key', async () => {
    const created = await service.createEndpoint(ENDPOINT);
    redis.srem.mockClear();
    redis.del.mockClear();

    const result = await service.deleteEndpoint({
      id: created.id,
      userId: ENDPOINT.userId,
      wallet: ENDPOINT.wallet,
    });

    expect(result).toEqual({ id: created.id });
    expect(endpoints.store.has(created.id)).toBe(false);
    expect(redis.srem).toHaveBeenCalledTimes(2);
    expect(redis.srem).toHaveBeenCalledWith('webhook:events:pool.created', created.id);
    expect(redis.srem).toHaveBeenCalledWith('webhook:events:vote.cast', created.id);
    expect(redis.del).toHaveBeenCalledWith(`webhook:endpoint:${created.id}:active`);
  });

  test('deleteEndpoint: propagates NOT_FOUND for an unknown id', async () => {
    await expect(
      service.deleteEndpoint({ id: 'unknown-id', userId: ENDPOINT.userId, wallet: ENDPOINT.wallet }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  test('findEndpointsByEvent: reads the Redis index first, then serves from the repository', async () => {
    const created = await service.createEndpoint(ENDPOINT);
    redis.smembers.mockImplementationOnce(async () => [created.id]);

    const found = await service.findEndpointsByEvent('pool.created');

    expect(redis.smembers).toHaveBeenCalledWith('webhook:events:pool.created');
    expect(endpoints.findByEvents).toHaveBeenCalledWith('pool.created');
    // The ids returned by smembers are only a cache-warm signal; the result
    // itself always comes from the repository.
    expect(found.map((doc) => doc._id.toString())).toEqual([created.id]);
  });

  test('findEndpointsByEvent: falls back to the repository when the Redis index is empty', async () => {
    const created = await service.createEndpoint(ENDPOINT);

    const found = await service.findEndpointsByEvent('pool.created');

    expect(redis.smembers).toHaveBeenCalledWith('webhook:events:pool.created');
    expect(endpoints.findByEvents).toHaveBeenCalledWith('pool.created');
    expect(found.map((doc) => doc._id.toString())).toEqual([created.id]);
  });

  test('findEndpointsByEvent: skips Redis when the client is not connected', async () => {
    await service.createEndpoint(ENDPOINT);
    redis.status = 'end';

    const found = await service.findEndpointsByEvent('pool.created');

    expect(redis.smembers).toHaveBeenCalledTimes(0);
    expect(endpoints.findByEvents).toHaveBeenCalledTimes(1);
    expect(found).toHaveLength(1);
  });

  test('findEndpointsByEvent: falls back to the repository when Redis throws', async () => {
    await service.createEndpoint(ENDPOINT);
    redis.smembers.mockImplementationOnce(async () => {
      throw new Error('redis down');
    });

    const found = await service.findEndpointsByEvent('pool.created');

    expect(endpoints.findByEvents).toHaveBeenCalledTimes(1);
    expect(found).toHaveLength(1);
  });

  test('isEndpointActive: the Redis breaker key wins over the database', async () => {
    const created = await service.createEndpoint(ENDPOINT);
    await redis.set(`webhook:endpoint:${created.id}:active`, '0');

    await expect(service.isEndpointActive(created.id)).resolves.toBe(false);
    expect(endpoints.findById).toHaveBeenCalledTimes(0);
  });

  test('isEndpointActive: without a breaker key it reads the database flag', async () => {
    const created = await service.createEndpoint(ENDPOINT);
    await expect(service.isEndpointActive(created.id)).resolves.toBe(true);

    // Flipped through the repository directly, so no breaker key is written.
    await endpoints.updateEndpoint(created.id, { active: false });
    await expect(service.isEndpointActive(created.id)).resolves.toBe(false);
  });

  test('isEndpointActive: skips Redis when the client is not connected', async () => {
    const created = await service.createEndpoint(ENDPOINT);
    redis.status = 'end';

    await expect(service.isEndpointActive(created.id)).resolves.toBe(true);
    expect(redis.get).toHaveBeenCalledTimes(0);
  });

  test('isEndpointActive: falls back to the database when Redis throws', async () => {
    const created = await service.createEndpoint(ENDPOINT);
    redis.get.mockImplementationOnce(async () => {
      throw new Error('redis down');
    });

    await expect(service.isEndpointActive(created.id)).resolves.toBe(true);
  });

  test('isEndpointActive: returns false when the endpoint does not exist', async () => {
    await expect(service.isEndpointActive('unknown-id')).resolves.toBe(false);
  });

  test('checkRateLimit: counts within the window and sets the TTL on the first hit', async () => {
    await expect(service.checkRateLimit('endpoint-1', 10)).resolves.toBe(true);
    expect(redis.incr).toHaveBeenCalledWith('webhook:endpoint:endpoint-1:rl');
    expect(redis.expire).toHaveBeenCalledWith('webhook:endpoint:endpoint-1:rl', 60);

    await expect(service.checkRateLimit('endpoint-1', 10)).resolves.toBe(true);
    expect(redis.expire).toHaveBeenCalledTimes(1); // the window is reused
  });

  test('checkRateLimit: returns false once the limit is exceeded', async () => {
    await service.checkRateLimit('endpoint-1', 2); // 1
    await service.checkRateLimit('endpoint-1', 2); // 2

    await expect(service.checkRateLimit('endpoint-1', 2)).resolves.toBe(false); // 3 > 2
  });

  test('checkRateLimit: fails open when Redis is unavailable', async () => {
    redis.incr.mockImplementationOnce(async () => {
      throw new Error('redis down');
    });

    await expect(service.checkRateLimit('endpoint-1', 1)).resolves.toBe(true);
  });
});
