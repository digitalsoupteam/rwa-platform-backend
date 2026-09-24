/**
 * Unit tests for the gateway OwnershipService.
 *
 * Constructor-injected dependencies (CacheService, auth client) are replaced
 * with fakes; no network, no Redis, no database.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { OwnershipService } from '../src/services/ownership.service';
import { edenError, edenOk, fakeEdenClient } from './fakes/clients.fake';
import type { AuthClient } from '../src/clients/eden.clients';
import type { CacheService } from '../src/services/cache.service';

const COMPANY = {
  id: 'company-1',
  ownerId: 'owner-1',
  users: [
    { userId: 'member-1', permissions: [{ permission: 'content', entity: '*' }] },
    { userId: 'member-2', permissions: [{ permission: 'deploy', entity: 'business-7' }] },
  ],
};

describe('OwnershipService (unit, fake cache/auth client)', () => {
  let cacheService: { getCompany: ReturnType<typeof mock> };
  let authClient: ReturnType<typeof fakeEdenClient>;
  let service: OwnershipService;

  beforeEach(() => {
    cacheService = { getCompany: mock(async () => edenOk(COMPANY)) };
    authClient = fakeEdenClient({ getUser: edenOk({ id: 'owner-1', wallet: '0xowner-wallet' }) });
    service = new OwnershipService(cacheService as unknown as CacheService, authClient as unknown as AuthClient);
  });

  test('checkOwnership (user): allows the owner himself', async () => {
    await expect(
      service.checkOwnership({ userId: 'u1', ownerId: 'u1', ownerType: 'user', permission: 'content' }),
    ).resolves.toBeUndefined();

    expect(cacheService.getCompany).toHaveBeenCalledTimes(0);
  });

  test('checkOwnership (user): rejects a different user with 403 FORBIDDEN', async () => {
    await expect(
      service.checkOwnership({ userId: 'u1', ownerId: 'u2', ownerType: 'user', permission: 'content' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  test('checkOwnership (company): allows the company owner', async () => {
    await expect(
      service.checkOwnership({ userId: 'owner-1', ownerId: 'company-1', ownerType: 'company', permission: 'deploy' }),
    ).resolves.toBeUndefined();

    expect(cacheService.getCompany).toHaveBeenCalledWith({ id: 'company-1' });
  });

  test('checkOwnership (company): member with wildcard permission passes for any entity', async () => {
    await expect(
      service.checkOwnership({
        userId: 'member-1',
        ownerId: 'company-1',
        ownerType: 'company',
        permission: 'content',
        entityId: 'business-9',
      }),
    ).resolves.toBeUndefined();
  });

  test('checkOwnership (company): member permission is entity-scoped when not wildcard', async () => {
    await expect(
      service.checkOwnership({
        userId: 'member-2',
        ownerId: 'company-1',
        ownerType: 'company',
        permission: 'deploy',
        entityId: 'business-7',
      }),
    ).resolves.toBeUndefined();

    await expect(
      service.checkOwnership({
        userId: 'member-2',
        ownerId: 'company-1',
        ownerType: 'company',
        permission: 'deploy',
        entityId: 'business-8',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  test('checkOwnership (company): member with a different permission is rejected', async () => {
    await expect(
      service.checkOwnership({
        userId: 'member-1',
        ownerId: 'company-1',
        ownerType: 'company',
        permission: 'deploy',
        entityId: 'business-9',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  test('checkOwnership (company): a user outside the company is rejected', async () => {
    await expect(
      service.checkOwnership({
        userId: 'stranger',
        ownerId: 'company-1',
        ownerType: 'company',
        permission: 'content',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  test('checkOwnership (company): a failed company lookup maps to 403 FORBIDDEN', async () => {
    cacheService.getCompany.mockImplementation(async () => edenError(404, 'NOT_FOUND', 'company not found'));

    await expect(
      service.checkOwnership({ userId: 'owner-1', ownerId: 'company-1', ownerType: 'company', permission: 'content' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  test('checkOwnership: an unknown ownerType is rejected with 403', async () => {
    await expect(
      service.checkOwnership({ userId: 'u1', ownerId: 'x', ownerType: 'dao', permission: 'content' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  test('getOwnerWallet (user): returns the caller wallet without any client call', async () => {
    const wallet = await service.getOwnerWallet({
      user: { id: 'u1', wallet: '0xuser-wallet' },
      ownerId: 'u1',
      ownerType: 'user',
    });

    expect(wallet).toBe('0xuser-wallet');
    expect(cacheService.getCompany).toHaveBeenCalledTimes(0);
    expect(authClient.getUser.post).toHaveBeenCalledTimes(0);
  });

  test('getOwnerWallet (company): resolves the company owner wallet via auth', async () => {
    const wallet = await service.getOwnerWallet({
      user: { id: 'member-1', wallet: '0xmember-wallet' },
      ownerId: 'company-1',
      ownerType: 'company',
    });

    expect(wallet).toBe('0xowner-wallet');
    expect(cacheService.getCompany).toHaveBeenCalledWith({ id: 'company-1' });
    expect(authClient.getUser.post).toHaveBeenCalledWith({ userId: 'owner-1' });
  });

  test('getOwnerWallet (company): failed company lookup maps to 403', async () => {
    cacheService.getCompany.mockImplementation(async () => edenError(500, 'INTERNAL_ERROR', 'boom'));

    await expect(
      service.getOwnerWallet({ user: { id: 'm', wallet: '0xw' }, ownerId: 'company-1', ownerType: 'company' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  test('getOwnerWallet (company): failed owner lookup maps to 403', async () => {
    authClient.getUser.post.mockImplementation(async () => edenError(404, 'NOT_FOUND', 'no user'));

    await expect(
      service.getOwnerWallet({ user: { id: 'm', wallet: '0xw' }, ownerId: 'company-1', ownerType: 'company' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  test('getOwnerWallet: an unknown ownerType is rejected with 403', async () => {
    await expect(
      service.getOwnerWallet({ user: { id: 'm', wallet: '0xw' }, ownerId: 'x', ownerType: 'dao' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });
});
