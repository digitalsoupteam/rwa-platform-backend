/**
 * Component tests for the api-keys HTTP layer.
 *
 * The whole Elysia app is assembled in-process: real controllers and the real
 * ApiKeyService, with the repository replaced by an in-memory fake. Requests
 * go through app.handle() — no port is bound, nothing is queried over the network.
 * Run with `bun test` from services/api-keys.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import crypto from 'crypto';
import { Elysia } from 'elysia';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createServicesPlugin } from '../src/plugins/services.plugin';
import { createControllersPlugin } from '../src/plugins/controllers.plugin';
import type { RepositoriesPlugin } from '../src/plugins/repositories.plugin';
import { createFakeApiKeyRepository, type FakeApiKeyRepository } from './fakes/apiKey.repository.fake';

const USER = {
  userId: 'user-1',
  wallet: '0xwallet1',
};

const API_KEY = {
  ...USER,
  name: 'CI key',
};

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

function buildApp(apiKeys: FakeApiKeyRepository) {
  const repositoriesPlugin = new Elysia({ name: 'Repositories' }).decorate('apiKeyRepository', apiKeys);

  const servicesPlugin = createServicesPlugin(repositoriesPlugin as unknown as RepositoriesPlugin);

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

describe('api-keys HTTP layer (component, fake repository)', () => {
  let apiKeys: FakeApiKeyRepository;
  let app: App;

  beforeEach(() => {
    apiKeys = createFakeApiKeyRepository();
    app = buildApp(apiKeys);
  });

  test('createApiKey → getApiKey → validateApiKey round-trip', async () => {
    const created = await post(app, '/createApiKey', API_KEY);
    expect(created.status).toBe(200);
    expect(created.body.name).toBe(API_KEY.name);
    expect(created.body.key).toMatch(/^apikey_[0-9a-f]{32}$/);
    expect(created.body.prefix).toBe(created.body.key.slice(0, 13));
    expect(typeof created.body.id).toBe('string');
    // The creation response carries the raw key once — and no hash or user scope.
    expect(Object.keys(created.body).sort()).toEqual(['createdAt', 'id', 'key', 'name', 'prefix']);

    const fetched = await post(app, '/getApiKey', { id: created.body.id, userId: USER.userId });
    expect(fetched.status).toBe(200);
    expect(fetched.body.id).toBe(created.body.id);
    expect(fetched.body.prefix).toBe(created.body.prefix);
    expect(fetched.body).not.toHaveProperty('keyHash');
    expect(JSON.stringify(fetched.body)).not.toContain(sha256(created.body.key));

    const validated = await post(app, '/validateApiKey', { apiKey: created.body.key });
    expect(validated.status).toBe(200);
    expect(validated.body).toEqual({ userId: USER.userId, wallet: USER.wallet });

    // Only the sha256 hash of the raw key is persisted.
    expect(apiKeys.store.get(created.body.id)!.keyHash).toBe(sha256(created.body.key));
  });

  test('getApiKeyById: internal read works without a user scope', async () => {
    const created = await post(app, '/createApiKey', API_KEY);

    const fetched = await post(app, '/getApiKeyById', { id: created.body.id });

    expect(fetched.status).toBe(200);
    expect(fetched.body.id).toBe(created.body.id);
    expect(fetched.body.userId).toBe(USER.userId);
    expect(fetched.body.wallet).toBe(USER.wallet);
    expect(fetched.body).not.toHaveProperty('keyHash');
  });

  test('getApiKeys: lists only the requesting user keys', async () => {
    await post(app, '/createApiKey', API_KEY);
    await post(app, '/createApiKey', { ...API_KEY, name: 'Second key' });
    await post(app, '/createApiKey', { userId: 'user-2', wallet: '0xwallet2', name: 'Foreign key' });

    const list = await post(app, '/getApiKeys', { userId: USER.userId });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.map((key: any) => key.name)).toEqual([API_KEY.name, 'Second key']);
    for (const key of list.body) {
      expect(key.userId).toBe(USER.userId);
      expect(typeof key.id).toBe('string');
      expect(key).not.toHaveProperty('_id');
      expect(key).not.toHaveProperty('keyHash');
    }

    const foreign = await post(app, '/getApiKeys', { userId: 'user-2' });
    expect(foreign.body).toHaveLength(1);
    expect(foreign.body[0].name).toBe('Foreign key');
  });

  test('updateApiKey: rename is visible through getApiKey', async () => {
    const created = await post(app, '/createApiKey', API_KEY);

    const updated = await post(app, '/updateApiKey', { id: created.body.id, userId: USER.userId, name: 'Renamed key' });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Renamed key');
    expect(updated.body.prefix).toBe(created.body.prefix);

    const fetched = await post(app, '/getApiKey', { id: created.body.id, userId: USER.userId });
    expect(fetched.body.name).toBe('Renamed key');
  });

  test('deleteApiKey: removes the key, then reads return 404', async () => {
    const created = await post(app, '/createApiKey', API_KEY);

    const deleted = await post(app, '/deleteApiKey', { id: created.body.id, userId: USER.userId });
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ id: created.body.id });

    const list = await post(app, '/getApiKeys', { userId: USER.userId });
    expect(list.body).toHaveLength(0);

    const fetched = await post(app, '/getApiKey', { id: created.body.id, userId: USER.userId });
    expect(fetched.status).toBe(404);

    const validated = await post(app, '/validateApiKey', { apiKey: created.body.key });
    expect(validated.status).toBe(404);
  });

  test('createApiKey: an invalid payload never reaches the repository', async () => {
    const response = await post(app, '/createApiKey', { name: 'Missing userId and wallet' });

    expect(response.status).not.toBe(200);
    expect(apiKeys.create).toHaveBeenCalledTimes(0);
  });

  test('getApiKey: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/getApiKey', { id: 'unknown-id', userId: USER.userId });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'ApiKey unknown-id not found' } });
  });

  test('getApiKey: another user cannot read the key (404)', async () => {
    const created = await post(app, '/createApiKey', API_KEY);

    const response = await post(app, '/getApiKey', { id: created.body.id, userId: 'user-2' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: `ApiKey ${created.body.id} not found` },
    });
  });

  test('validateApiKey: an unknown key maps to 404 NOT_FOUND and is looked up hashed', async () => {
    const unknownKey = 'apikey_' + '0'.repeat(32);

    const response = await post(app, '/validateApiKey', { apiKey: unknownKey });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'ApiKey not found' } });
    expect(apiKeys.findByKeyHash).toHaveBeenCalledWith(sha256(unknownKey));
  });
});
