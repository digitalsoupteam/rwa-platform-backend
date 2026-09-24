/**
 * Unit tests for the gateway UserResolverService.
 *
 * resolveUser resolves the caller from either an API key (via the api-keys
 * service) or a JWT. Both client paths are faked; the JWT path runs the real
 * jwt utils, so the env secret is set before the module under test is imported
 * (dynamic import below).
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import * as jwt from 'jsonwebtoken';
import { edenError, edenOk, fakeEdenClient } from './fakes/clients.fake';
import type { ApiKeysClient, AuthClient } from '../src/clients/eden.clients';

const TEST_SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = TEST_SECRET;

const { UserResolverService } = await import('../src/services/userResolver.service');

const sign = (payload: Record<string, unknown>) => jwt.sign(payload, TEST_SECRET, { expiresIn: 900 });

describe('UserResolverService (unit, fake clients)', () => {
  let authClient: ReturnType<typeof fakeEdenClient>;
  let apiKeysClient: ReturnType<typeof fakeEdenClient>;
  let service: InstanceType<typeof UserResolverService>;

  beforeEach(() => {
    authClient = fakeEdenClient();
    apiKeysClient = fakeEdenClient({ validateApiKey: edenOk({ userId: 'u1', wallet: '0xw' }) });
    service = new UserResolverService(authClient as unknown as AuthClient, apiKeysClient as unknown as ApiKeysClient);
  });

  test('returns null without a token and calls nothing', async () => {
    expect(await service.resolveUser(null)).toBeNull();
    expect(apiKeysClient.validateApiKey.post).toHaveBeenCalledTimes(0);
  });

  test('api key: resolves the user through the api-keys service', async () => {
    const result = await service.resolveUser('apikey_abc');

    expect(result).toEqual({ userId: 'u1', wallet: '0xw' });
    expect(apiKeysClient.validateApiKey.post).toHaveBeenCalledWith({ apiKey: 'apikey_abc' });
  });

  test('api key: a 404 from the api-keys service resolves to null', async () => {
    apiKeysClient.validateApiKey.post.mockImplementation(async () => edenError(404, 'NOT_FOUND', 'unknown key'));

    expect(await service.resolveUser('apikey_unknown')).toBeNull();
  });

  test('api key: a 5xx from the api-keys service maps to 503 SERVICE_UNAVAILABLE', async () => {
    apiKeysClient.validateApiKey.post.mockImplementation(async () => edenError(500, 'INTERNAL_ERROR', 'boom'));

    await expect(service.resolveUser('apikey_abc')).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  test('jwt: resolves an access token into { userId, wallet }', async () => {
    const token = sign({ userId: 'u1', wallet: '0xw', type: 'access' });

    expect(await service.resolveUser(token)).toEqual({ userId: 'u1', wallet: '0xw' });
    expect(apiKeysClient.validateApiKey.post).toHaveBeenCalledTimes(0);
  });

  test('jwt: a refresh token resolves to null', async () => {
    const token = sign({ userId: 'u1', wallet: '0xw', type: 'refresh' });

    expect(await service.resolveUser(token)).toBeNull();
  });

  test('jwt: garbage resolves to null', async () => {
    expect(await service.resolveUser('not-a-jwt')).toBeNull();
  });

  test('jwt: a token signed with another secret resolves to null', async () => {
    const token = jwt.sign({ userId: 'u1', wallet: '0xw', type: 'access' }, 'other-secret', { expiresIn: 900 });

    expect(await service.resolveUser(token)).toBeNull();
  });
});
