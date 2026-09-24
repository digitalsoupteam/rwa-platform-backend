/**
 * Unit tests for TokenService.
 *
 * Scope: the service layer only. Both repositories are replaced with
 * in-memory fakes (tests/fakes/*.fake.ts), so these tests need no database and
 * no network. Run with `bun test` from services/rwa.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { TokenService } from '../src/services/token.service';
import type { PoolRepository } from '../src/repositories/pool.repository';
import type { BusinessRepository } from '../src/repositories/business.repository';
import { createFakeBusinessRepository, type FakeBusinessRepository } from './fakes/business.repository.fake';
import { createFakePoolRepository, type FakePoolRepository } from './fakes/pool.repository.fake';

const OWNER_ID = 'owner-1';
const OWNER_TYPE = 'business';
const CHAIN_ID = '97';
const RWA_ADDRESS = '0x00000000000000000000000000000000000000bb';
const TOKEN_ID = '42';
const PLACEHOLDER_IMAGE_URL = 'https://test.domain/placeholder.png';
const FILES_BASE_URL = 'https://files.test/files';

describe('TokenService (unit, fake repositories)', () => {
  let businesses: FakeBusinessRepository;
  let pools: FakePoolRepository;
  let service: TokenService;

  beforeEach(() => {
    businesses = createFakeBusinessRepository();
    pools = createFakePoolRepository();
    service = new TokenService(
      pools as unknown as PoolRepository,
      businesses as unknown as BusinessRepository,
      PLACEHOLDER_IMAGE_URL,
      FILES_BASE_URL,
    );
  });

  test('getTokenMetadata: combines business and pool data into ERC-1155 metadata', async () => {
    const business = await businesses.createBusiness({
      ownerId: OWNER_ID,
      ownerType: OWNER_TYPE,
      name: 'Alpha Ventures',
      chainId: CHAIN_ID,
      description: 'Business description',
    });
    await businesses.updateBusiness(business._id.toString(), { riskScore: 55 });
    const pool = await pools.createPool({
      ownerId: OWNER_ID,
      ownerType: OWNER_TYPE,
      name: 'Alpha Pool',
      businessId: business._id.toString(),
      chainId: CHAIN_ID,
      rwaAddress: RWA_ADDRESS,
      tokenId: TOKEN_ID,
      description: 'Pool description',
      expectedHoldAmount: '1000',
      expectedRwaAmount: '2000',
      rewardPercent: '500',
      entryFeePercent: '100',
      exitFeePercent: '100',
    });

    const metadata = await service.getTokenMetadata({ rwaAddress: RWA_ADDRESS, tokenId: TOKEN_ID });

    expect(metadata.name).toBe('Alpha Pool');
    expect(metadata.description).toBe('Business description\n\nPool description');
    expect(metadata.decimals).toBe(18);
    expect(metadata.image).toBe(PLACEHOLDER_IMAGE_URL); // neither business nor pool has an image

    expect(metadata.properties.business).toEqual({
      id: business._id.toString(),
      name: 'Alpha Ventures',
      riskScore: 55,
    });
    expect(metadata.properties.pool.address).toBeUndefined();
    expect(metadata.properties.pool.expectedHoldAmount).toBe('1000');
    expect(metadata.properties.pool.expectedRwaAmount).toBe('2000');
    expect(metadata.properties.pool.rewardPercent).toBe('500');
    expect(metadata.properties.pool.entryFeePercent).toBe('100');
    expect(metadata.properties.pool.exitFeePercent).toBe('100');
    expect(metadata.properties.status).toEqual({
      isTargetReached: false,
      isFullyReturned: false,
      paused: false,
    });
    expect(metadata.properties.tags).toEqual([]);
    expect(pool.tokenId).toBe(TOKEN_ID); // fixture sanity check
  });

  test('getTokenMetadata: prefers the pool image over the business image', async () => {
    const business = await businesses.createBusiness({
      ownerId: OWNER_ID,
      ownerType: OWNER_TYPE,
      name: 'Alpha Ventures',
      chainId: CHAIN_ID,
      image: 'business/image.png',
    });
    const pool = await pools.createPool({
      ownerId: OWNER_ID,
      ownerType: OWNER_TYPE,
      name: 'Alpha Pool',
      businessId: business._id.toString(),
      chainId: CHAIN_ID,
      rwaAddress: RWA_ADDRESS,
      tokenId: TOKEN_ID,
      image: 'pool/image.png',
    });

    const metadata = await service.getTokenMetadata({ rwaAddress: RWA_ADDRESS, tokenId: TOKEN_ID });

    expect(metadata.image).toBe(`${FILES_BASE_URL}/pool/image.png`);
    expect(pool.image).toBe('pool/image.png');
  });

  test('getTokenMetadata: falls back to the business image when the pool has none', async () => {
    const business = await businesses.createBusiness({
      ownerId: OWNER_ID,
      ownerType: OWNER_TYPE,
      name: 'Alpha Ventures',
      chainId: CHAIN_ID,
      image: 'business/image.png',
    });
    await pools.createPool({
      ownerId: OWNER_ID,
      ownerType: OWNER_TYPE,
      name: 'Alpha Pool',
      businessId: business._id.toString(),
      chainId: CHAIN_ID,
      rwaAddress: RWA_ADDRESS,
      tokenId: TOKEN_ID,
    });

    const metadata = await service.getTokenMetadata({ rwaAddress: RWA_ADDRESS, tokenId: TOKEN_ID });

    expect(metadata.image).toBe(`${FILES_BASE_URL}/business/image.png`);
  });

  test('getTokenMetadata: falls back to the default description when both are empty', async () => {
    const business = await businesses.createBusiness({
      ownerId: OWNER_ID,
      ownerType: OWNER_TYPE,
      name: 'Alpha Ventures',
      chainId: CHAIN_ID,
    });
    await pools.createPool({
      ownerId: OWNER_ID,
      ownerType: OWNER_TYPE,
      name: 'Alpha Pool',
      businessId: business._id.toString(),
      chainId: CHAIN_ID,
      rwaAddress: RWA_ADDRESS,
      tokenId: TOKEN_ID,
    });

    const metadata = await service.getTokenMetadata({ rwaAddress: RWA_ADDRESS, tokenId: TOKEN_ID });

    expect(metadata.description).toBe('Real World Asset Pool Token');
  });

  test('getTokenMetadata: propagates NOT_FOUND for an unknown rwaAddress/tokenId pair', async () => {
    await expect(service.getTokenMetadata({ rwaAddress: RWA_ADDRESS, tokenId: '9' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: `Pool with rwaAddress ${RWA_ADDRESS} and tokenId 9 not found`,
    });
  });
});
