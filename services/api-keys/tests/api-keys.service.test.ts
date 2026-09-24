/**
 * Unit tests for ApiKeyService.
 *
 * Scope: the service layer only. The repository is replaced with an in-memory
 * fake (tests/fakes/*.fake.ts), so these tests need no database, no broker
 * and no network. Run with `bun test` from services/api-keys.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import crypto from 'crypto';
import { AppError } from '@shared/errors/app-errors';
import { ApiKeyService } from '../src/services/apiKey.service';
import type { ApiKeyRepository } from '../src/repositories/apiKey.repository';
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

describe('ApiKeyService (unit, fake repository)', () => {
  let apiKeys: FakeApiKeyRepository;
  let service: ApiKeyService;

  beforeEach(() => {
    apiKeys = createFakeApiKeyRepository();
    service = new ApiKeyService(apiKeys as unknown as ApiKeyRepository);
  });

  test('createApiKey: stores the sha256 hash only and returns the raw key once', async () => {
    const created = await service.createApiKey(API_KEY);

    expect(apiKeys.create).toHaveBeenCalledTimes(1);
    // The repository receives the hash and the prefix, never the raw key.
    expect(apiKeys.create).toHaveBeenCalledWith({
      userId: USER.userId,
      wallet: USER.wallet,
      name: API_KEY.name,
      keyHash: sha256(created.key),
      prefix: created.key.slice(0, 13),
    });

    // Raw key format: 'apikey_' + 32 hex chars (16 random bytes).
    expect(created.key).toMatch(/^apikey_[0-9a-f]{32}$/);
    expect(created.name).toBe(API_KEY.name);
    expect(created.prefix).toBe(created.key.slice(0, 13));
    expect(typeof created.id).toBe('string');
    expect(created.id).toHaveLength(24); // Mongo ObjectId hex
    expect(typeof created.createdAt).toBe('number');
    expect(created).not.toHaveProperty('_id');
    expect(created).not.toHaveProperty('keyHash');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(created))).toEqual(created);

    // Only the hash and the prefix are persisted — the raw key is not recoverable from the store.
    const stored = apiKeys.store.get(created.id)!;
    expect(stored.keyHash).toBe(sha256(created.key));
    expect(stored.keyHash).toHaveLength(64);
    expect(stored.prefix).toBe(created.key.slice(0, 13));
    expect(JSON.stringify(stored)).not.toContain(created.key);
  });

  test('createApiKey: generates a distinct key and hash on every call', async () => {
    const first = await service.createApiKey(API_KEY);
    const second = await service.createApiKey({ ...API_KEY, name: 'Second key' });

    expect(first.key).not.toBe(second.key);
    expect(sha256(first.key)).not.toBe(sha256(second.key));
    expect(apiKeys.store.size).toBe(2);
  });

  test('createApiKey: propagates an AppError raised by the repository unchanged', async () => {
    apiKeys.create.mockImplementationOnce(async () => {
      throw new AppError({ message: 'Duplicate key hash', statusCode: 409, code: 'CONFLICT' });
    });

    await expect(service.createApiKey(API_KEY)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Duplicate key hash',
    });
  });

  test('validateApiKey: looks up by sha256 hash and returns only { userId, wallet }', async () => {
    const created = await service.createApiKey(API_KEY);

    const result = await service.validateApiKey(created.key);

    expect(apiKeys.findByKeyHash).toHaveBeenCalledTimes(1);
    expect(apiKeys.findByKeyHash).toHaveBeenCalledWith(sha256(created.key));
    // The raw key is never used as the lookup value.
    expect(apiKeys.findByKeyHash).not.toHaveBeenCalledWith(created.key);
    expect(result).toEqual({ userId: USER.userId, wallet: USER.wallet });
    expect(Object.keys(result).sort()).toEqual(['userId', 'wallet']);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  test('validateApiKey: resolves every key to its own owner', async () => {
    const mine = await service.createApiKey(API_KEY);
    const foreign = await service.createApiKey({ userId: 'user-2', wallet: '0xwallet2', name: 'Foreign key' });

    await expect(service.validateApiKey(mine.key)).resolves.toEqual({ userId: 'user-1', wallet: '0xwallet1' });
    await expect(service.validateApiKey(foreign.key)).resolves.toEqual({ userId: 'user-2', wallet: '0xwallet2' });
  });

  test('validateApiKey: propagates NOT_FOUND for an unknown key', async () => {
    const unknownKey = 'apikey_' + '0'.repeat(32);

    await expect(service.validateApiKey(unknownKey)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'ApiKey not found',
    });
  });

  test('getApiKey: forwards the user scope and returns the mapped key', async () => {
    const created = await service.createApiKey(API_KEY);

    const fetched = await service.getApiKey({ id: created.id, userId: USER.userId });

    expect(apiKeys.findById).toHaveBeenCalledTimes(1);
    expect(apiKeys.findById).toHaveBeenCalledWith({ id: created.id, userId: USER.userId });
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe(API_KEY.name);
    expect(fetched.prefix).toBe(created.prefix);
    expect(fetched.userId).toBe(USER.userId);
    expect(fetched.wallet).toBe(USER.wallet);
    expect(typeof fetched.createdAt).toBe('number');
    expect(typeof fetched.updatedAt).toBe('number');
    expect(fetched).not.toHaveProperty('_id');
    expect(fetched).not.toHaveProperty('keyHash');
    expect(JSON.parse(JSON.stringify(fetched))).toEqual(fetched);
  });

  test('getApiKey: a key of another user is NOT_FOUND (no cross-user read)', async () => {
    const created = await service.createApiKey(API_KEY);

    await expect(service.getApiKey({ id: created.id, userId: 'user-2' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: `ApiKey ${created.id} not found`,
    });
  });

  test('getApiKey: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getApiKey({ id: 'unknown-id', userId: USER.userId })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getApiKeyById: reads without user scope and returns the mapped key', async () => {
    const created = await service.createApiKey(API_KEY);

    const fetched = await service.getApiKeyById(created.id);

    expect(apiKeys.findByIdUnscoped).toHaveBeenCalledTimes(1);
    expect(apiKeys.findByIdUnscoped).toHaveBeenCalledWith(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.userId).toBe(USER.userId);
    expect(fetched.wallet).toBe(USER.wallet);
    expect(fetched.name).toBe(API_KEY.name);
    expect(fetched.prefix).toBe(created.prefix);
    expect(fetched).not.toHaveProperty('_id');
    expect(fetched).not.toHaveProperty('keyHash');
    expect(JSON.parse(JSON.stringify(fetched))).toEqual(fetched);
  });

  test('getApiKeyById: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getApiKeyById('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'ApiKey unknown-id not found',
    });
  });

  test('getApiKeys: lists only the requesting user keys and maps every entry', async () => {
    const first = await service.createApiKey(API_KEY);
    await service.createApiKey({ ...API_KEY, name: 'Second key' });
    await service.createApiKey({ userId: 'user-2', wallet: '0xwallet2', name: 'Foreign key' });

    const result = await service.getApiKeys({ userId: USER.userId });

    expect(apiKeys.findAll).toHaveBeenCalledWith({ userId: USER.userId });
    expect(result).toHaveLength(2);
    expect(result.map((key) => key.name)).toEqual([API_KEY.name, 'Second key']); // insertion order is stable in the fake
    for (const key of result) {
      expect(typeof key.id).toBe('string');
      expect(key.id).toHaveLength(24);
      expect(key.userId).toBe(USER.userId);
      expect(key).not.toHaveProperty('_id');
      expect(key).not.toHaveProperty('keyHash');
    }
    expect(result.some((key) => key.id === first.id)).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  test('getApiKeys: returns an empty array for a user without keys', async () => {
    await service.createApiKey(API_KEY);

    const result = await service.getApiKeys({ userId: 'nobody' });

    expect(result).toEqual([]);
  });

  test('updateApiKey: forwards the rename payload and returns the mapped key', async () => {
    const created = await service.createApiKey(API_KEY);

    const updated = await service.updateApiKey({ id: created.id, userId: USER.userId, name: 'Renamed key' });

    expect(apiKeys.update).toHaveBeenCalledTimes(1);
    expect(apiKeys.update).toHaveBeenCalledWith({ id: created.id, userId: USER.userId, name: 'Renamed key' });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed key');
    // A rename never touches the key material or the prefix.
    expect(updated.prefix).toBe(created.prefix);
    expect(updated).not.toHaveProperty('_id');
    expect(updated).not.toHaveProperty('keyHash');
    expect(JSON.parse(JSON.stringify(updated))).toEqual(updated);
  });

  test('updateApiKey: a foreign user scope is NOT_FOUND and leaves the key unchanged', async () => {
    const created = await service.createApiKey(API_KEY);

    await expect(service.updateApiKey({ id: created.id, userId: 'user-2', name: 'Hijacked' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
    expect(apiKeys.store.get(created.id)?.name).toBe(API_KEY.name);
  });

  test('updateApiKey: propagates NOT_FOUND for an unknown id', async () => {
    await expect(
      service.updateApiKey({ id: 'unknown-id', userId: USER.userId, name: 'Renamed' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('deleteApiKey: deletes by id scoped to the user and returns { id }', async () => {
    const created = await service.createApiKey(API_KEY);
    const other = await service.createApiKey({ ...API_KEY, name: 'Keep me' });

    const result = await service.deleteApiKey({ id: created.id, userId: USER.userId });

    expect(apiKeys.delete).toHaveBeenCalledTimes(1);
    expect(apiKeys.delete).toHaveBeenCalledWith({ id: created.id, userId: USER.userId });
    expect(result).toEqual({ id: created.id });
    expect(apiKeys.store.has(created.id)).toBe(false);
    expect(apiKeys.store.has(other.id)).toBe(true);
  });

  test('deleteApiKey: a foreign user cannot delete the key', async () => {
    const created = await service.createApiKey(API_KEY);

    await expect(service.deleteApiKey({ id: created.id, userId: 'user-2' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
    expect(apiKeys.store.has(created.id)).toBe(true);
  });

  test('deleteApiKey: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.deleteApiKey({ id: 'unknown-id', userId: USER.userId })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('lifecycle: a deleted key no longer validates', async () => {
    const created = await service.createApiKey(API_KEY);

    await service.deleteApiKey({ id: created.id, userId: USER.userId });

    await expect(service.validateApiKey(created.key)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});
