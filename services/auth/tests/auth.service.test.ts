/**
 * Unit tests for AuthService.
 *
 * Scope: the service layer only. Repositories are replaced with in-memory
 * fakes (tests/fakes/*.fake.ts), so these tests need no database, no broker
 * and no network. Wallet signatures are real EIP-712 signatures produced by
 * locally generated ethers wallets. Run with `bun test` from services/auth.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ethers, HDNodeWallet } from 'ethers';
import { AppError } from '@shared/errors/app-errors';
import { AuthService } from '../src/services/auth.service';
import type { UserRepository } from '../src/repositories/user.repository';
import type { RefreshTokenRepository } from '../src/repositories/refreshToken.repository';
import { createFakeUserRepository, type FakeUserRepository } from './fakes/user.repository.fake';
import {
  createFakeRefreshTokenRepository,
  type FakeRefreshTokenRepository,
} from './fakes/refreshToken.repository.fake';

const JWT_SECRET = 'unit-test-jwt-secret';
const ACCESS_TOKEN_EXPIRY = 900; // 15 minutes, in seconds
const REFRESH_TOKEN_EXPIRY = 604800; // 7 days, in seconds
const DOMAIN_NAME = 'RWA Platform';
const DOMAIN_VERSION = '1';

// Byte-for-byte the welcome text the service rebuilds inside verifySignature().
const WELCOME_MESSAGE = `Welcome to RWA Platform!

We prioritize the security of your assets and personal data. To ensure secure access to your account, we kindly request you to verify ownership of your wallet by signing this message.`;

const AUTH_DOMAIN = { name: DOMAIN_NAME, version: DOMAIN_VERSION };
const AUTH_MESSAGE_TYPES = [
  { name: 'wallet', type: 'address' },
  { name: 'timestamp', type: 'uint256' },
  { name: 'message', type: 'string' },
];

const nowSeconds = () => Math.floor(Date.now() / 1000);
const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

function buildAuthMessage(wallet: string, timestamp: number) {
  return { wallet, timestamp, message: WELCOME_MESSAGE };
}

// Signs the same EIP-712 payload the client signs; the service rebuilds that payload when verifying.
async function signAuthMessage(signer: HDNodeWallet, timestamp: number) {
  const message = buildAuthMessage(signer.address, timestamp);
  const signature = await signer.signTypedData(AUTH_DOMAIN, { Message: AUTH_MESSAGE_TYPES }, message);

  return { wallet: signer.address, signature, timestamp };
}

describe('AuthService (unit, fake repositories)', () => {
  let users: FakeUserRepository;
  let refreshTokens: FakeRefreshTokenRepository;
  let service: AuthService;

  beforeEach(() => {
    users = createFakeUserRepository();
    refreshTokens = createFakeRefreshTokenRepository();
    service = new AuthService(
      users as unknown as UserRepository,
      refreshTokens as unknown as RefreshTokenRepository,
      JWT_SECRET,
      ACCESS_TOKEN_EXPIRY,
      REFRESH_TOKEN_EXPIRY,
      DOMAIN_NAME,
      DOMAIN_VERSION,
    );
  });

  test('authenticate: verifies a real EIP-712 signature and returns mapped tokens', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await signAuthMessage(wallet, nowSeconds());

    const result = await service.authenticate(auth);

    expect(users.exists).toHaveBeenCalledTimes(1);
    expect(users.exists).toHaveBeenCalledWith(wallet.address);
    expect(users.findOrCreate).toHaveBeenCalledTimes(1);
    expect(users.findOrCreate).toHaveBeenCalledWith(wallet.address);

    expect(typeof result.userId).toBe('string');
    expect(result.userId).toHaveLength(24); // Mongo ObjectId hex
    expect(result.wallet).toBe(wallet.address.toLowerCase());
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.accessToken).not.toBe(result.refreshToken);
  });

  test('authenticate: access and refresh tokens carry the expected JWT payloads', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await signAuthMessage(wallet, nowSeconds());

    const result = await service.authenticate(auth);

    const accessPayload = jwt.decode(result.accessToken) as any;
    const refreshPayload = jwt.decode(result.refreshToken) as any;

    // The token wallet is the value from the request; the response wallet is the stored (lowercased) one.
    expect(accessPayload).toMatchObject({ userId: result.userId, wallet: wallet.address, type: 'access' });
    expect(refreshPayload).toMatchObject({ userId: result.userId, wallet: wallet.address, type: 'refresh' });
    expect(accessPayload.jti).not.toBe(refreshPayload.jti);
    expect(accessPayload.exp - accessPayload.iat).toBe(ACCESS_TOKEN_EXPIRY);
    expect(refreshPayload.exp - refreshPayload.iat).toBe(REFRESH_TOKEN_EXPIRY);

    // Both tokens must verify with the configured secret and fail with any other.
    expect(() => jwt.verify(result.accessToken, JWT_SECRET)).not.toThrow();
    expect(() => jwt.verify(result.refreshToken, JWT_SECRET)).not.toThrow();
    expect(() => jwt.verify(result.accessToken, 'another-secret')).toThrow();
  });

  test('authenticate: stores only the sha256 hash of the refresh token', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await signAuthMessage(wallet, nowSeconds());

    const result = await service.authenticate(auth);

    const expectedHash = sha256(result.refreshToken);
    expect(refreshTokens.create).toHaveBeenCalledTimes(1);

    const [userIdArg, tokenHashArg, expiresAtArg] = refreshTokens.create.mock.calls[0];
    expect(userIdArg).toBe(result.userId);
    expect(tokenHashArg).toBe(expectedHash);
    expect(tokenHashArg).not.toBe(result.refreshToken);
    expect(expiresAtArg).toBe((jwt.decode(result.refreshToken) as any).exp);

    const stored = Array.from(refreshTokens.store.values());
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).toBe(expectedHash);
    expect(stored[0].userId.toString()).toBe(result.userId);
  });

  test('authenticate: reuses the existing user record on the next call', async () => {
    const wallet = ethers.Wallet.createRandom();
    const first = await service.authenticate(await signAuthMessage(wallet, nowSeconds()));
    const second = await service.authenticate(await signAuthMessage(wallet, nowSeconds()));

    expect(second.userId).toBe(first.userId);
    expect(users.store.size).toBe(1);
    expect(users.exists).toHaveBeenCalledTimes(2);
    expect(users.findOrCreate).toHaveBeenCalledTimes(2);
  });

  test('authenticate: accepts a timestamp just inside the allowed window', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await signAuthMessage(wallet, nowSeconds() - 59);

    const result = await service.authenticate(auth);

    expect(result.wallet).toBe(wallet.address.toLowerCase());
    expect(users.findOrCreate).toHaveBeenCalledTimes(1);
  });

  test('authenticate: rejects a timestamp outside the allowed window', async () => {
    const wallet = ethers.Wallet.createRandom();

    for (const offset of [-120, 120]) {
      const auth = await signAuthMessage(wallet, nowSeconds() + offset);

      await expect(service.authenticate(auth)).rejects.toMatchObject({
        statusCode: 401,
        code: 'AUTHENTICATION_ERROR',
        message: 'Timestamp is too far from server time',
      });
    }

    // The timestamp check runs before signature verification and the user lookup.
    expect(users.exists).toHaveBeenCalledTimes(0);
    expect(users.findOrCreate).toHaveBeenCalledTimes(0);
  });

  test('authenticate: rejects a signature produced by another wallet', async () => {
    const wallet = ethers.Wallet.createRandom();
    const impostor = ethers.Wallet.createRandom();
    const timestamp = nowSeconds();
    const signature = await impostor.signTypedData(
      AUTH_DOMAIN,
      { Message: AUTH_MESSAGE_TYPES },
      buildAuthMessage(wallet.address, timestamp),
    );

    await expect(service.authenticate({ wallet: wallet.address, signature, timestamp })).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTHENTICATION_ERROR',
      message: 'Invalid signature',
    });

    expect(users.exists).toHaveBeenCalledTimes(0);
    expect(users.findOrCreate).toHaveBeenCalledTimes(0);
    expect(refreshTokens.create).toHaveBeenCalledTimes(0);
  });

  test('authenticate: rejects a malformed signature', async () => {
    const wallet = ethers.Wallet.createRandom();

    await expect(
      service.authenticate({ wallet: wallet.address, signature: 'not-a-signature', timestamp: nowSeconds() }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTHENTICATION_ERROR',
      message: 'Invalid signature',
    });

    expect(users.exists).toHaveBeenCalledTimes(0);
    expect(users.findOrCreate).toHaveBeenCalledTimes(0);
  });

  test('refreshToken: rotates the token pair and maps the user', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await service.authenticate(await signAuthMessage(wallet, nowSeconds()));
    const oldHash = sha256(auth.refreshToken);

    const refreshed = await service.refreshToken({ refreshToken: auth.refreshToken });

    expect(refreshTokens.findByTokenHash).toHaveBeenCalledWith(oldHash);
    expect(refreshTokens.deleteTokens).toHaveBeenCalledWith(auth.userId, [oldHash]);
    expect(users.findById).toHaveBeenCalledWith(auth.userId);

    expect(refreshed.userId).toBe(auth.userId);
    expect(refreshed.wallet).toBe(wallet.address.toLowerCase());
    expect(refreshed.accessToken).not.toBe(auth.accessToken);
    expect(refreshed.refreshToken).not.toBe(auth.refreshToken);
    expect((jwt.decode(refreshed.refreshToken) as any).type).toBe('refresh');

    // The used hash is gone; only the rotated token remains, stored hashed.
    const storedHashes = Array.from(refreshTokens.store.values()).map((token) => token.tokenHash);
    expect(storedHashes).toEqual([sha256(refreshed.refreshToken)]);
  });

  test('refreshToken: a refresh token can only be used once', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await service.authenticate(await signAuthMessage(wallet, nowSeconds()));

    await service.refreshToken({ refreshToken: auth.refreshToken });

    await expect(service.refreshToken({ refreshToken: auth.refreshToken })).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTHENTICATION_ERROR',
      message: 'Invalid refresh token',
    });
  });

  test('refreshToken: rejects an access token', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await service.authenticate(await signAuthMessage(wallet, nowSeconds()));

    await expect(service.refreshToken({ refreshToken: auth.accessToken })).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTHENTICATION_ERROR',
      message: 'Invalid token type',
    });

    // The type check short-circuits before any database lookup.
    expect(refreshTokens.findByTokenHash).toHaveBeenCalledTimes(0);
    expect(refreshTokens.deleteTokens).toHaveBeenCalledTimes(0);
  });

  test('refreshToken: rejects a well-formed token that has no stored record', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await service.authenticate(await signAuthMessage(wallet, nowSeconds()));
    const stray = jwt.sign(
      { userId: auth.userId, wallet: wallet.address, type: 'refresh', jti: 'stray-jti' },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY },
    );

    await expect(service.refreshToken({ refreshToken: stray })).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTHENTICATION_ERROR',
      message: 'Invalid refresh token',
    });

    expect(refreshTokens.findByTokenHash).toHaveBeenCalledWith(sha256(stray));
    expect(refreshTokens.deleteTokens).toHaveBeenCalledTimes(0);
  });

  test('refreshToken: surfaces NOT_FOUND when the user record is gone', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await service.authenticate(await signAuthMessage(wallet, nowSeconds()));
    users.store.delete(auth.userId);

    await expect(service.refreshToken({ refreshToken: auth.refreshToken })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('refreshToken: a string that is not a JWT fails in token verification', async () => {
    const error = await service.refreshToken({ refreshToken: 'not-a-token' }).then(
      () => null,
      (caught) => caught,
    );

    // jwt.verify throws raw (non-AppError) errors for malformed or expired tokens — the service does not wrap them.
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AppError);
    expect(refreshTokens.findByTokenHash).toHaveBeenCalledTimes(0);
  });

  test('getUser: returns the mapped user record', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await service.authenticate(await signAuthMessage(wallet, nowSeconds()));

    const user = await service.getUser(auth.userId);

    expect(users.findById).toHaveBeenCalledWith(auth.userId);
    expect(user).toEqual({
      userId: auth.userId,
      wallet: wallet.address.toLowerCase(),
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    });
    expect(user).not.toHaveProperty('_id');
    // The result must be plain JSON — no ObjectId or class instances leaking to the caller.
    expect(JSON.parse(JSON.stringify(user))).toEqual(user);
  });

  test('getUser: propagates NOT_FOUND for an unknown id', async () => {
    await expect(service.getUser('unknown-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('getUserTokens: maps every stored token to a plain object', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await service.authenticate(await signAuthMessage(wallet, nowSeconds()));

    const tokens = await service.getUserTokens(auth.userId);

    expect(refreshTokens.findByUserId).toHaveBeenCalledWith(auth.userId);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({
      tokenId: expect.any(String),
      userId: auth.userId,
      tokenHash: sha256(auth.refreshToken),
      expiresAt: (jwt.decode(auth.refreshToken) as any).exp,
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    });
    expect(tokens[0]).not.toHaveProperty('_id');
    expect(JSON.parse(JSON.stringify(tokens))).toEqual(tokens);
  });

  test('getUserTokens: returns an empty array when the user has no tokens', async () => {
    const tokens = await service.getUserTokens('user-without-tokens');

    expect(refreshTokens.findByUserId).toHaveBeenCalledWith('user-without-tokens');
    expect(tokens).toEqual([]);
  });

  test('revokeTokens: deletes only the requested hashes and returns the count', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await service.authenticate(await signAuthMessage(wallet, nowSeconds()));
    const hash = sha256(auth.refreshToken);

    const result = await service.revokeTokens(auth.userId, [hash, 'unknown-hash']);

    expect(refreshTokens.deleteTokens).toHaveBeenCalledWith(auth.userId, [hash, 'unknown-hash']);
    expect(result).toEqual({ revokedCount: 1 });
    expect(refreshTokens.store.size).toBe(0);
  });

  test('revokeTokens: returns zero when nothing matches', async () => {
    const result = await service.revokeTokens('unknown-user', ['unknown-hash']);

    expect(refreshTokens.deleteTokens).toHaveBeenCalledWith('unknown-user', ['unknown-hash']);
    expect(result).toEqual({ revokedCount: 0 });
  });
});
