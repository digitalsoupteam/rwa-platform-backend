/**
 * Component tests for the auth HTTP layer.
 *
 * The whole Elysia app is assembled in-process: real controllers and the real
 * AuthService, with repositories replaced by in-memory fakes. Requests go
 * through app.handle() — no port is bound, nothing is queried over the network.
 * Run with `bun test` from services/auth.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Elysia } from 'elysia';
import { ethers, HDNodeWallet } from 'ethers';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createServicesPlugin } from '../src/plugins/services.plugin';
import { createControllersPlugin } from '../src/plugins/controllers.plugin';
import type { RepositoriesPlugin } from '../src/plugins/repositories.plugin';
import { createFakeUserRepository, type FakeUserRepository } from './fakes/user.repository.fake';
import {
  createFakeRefreshTokenRepository,
  type FakeRefreshTokenRepository,
} from './fakes/refreshToken.repository.fake';

// Mirrors the environment variables src/index.ts reads and passes to createApp().
process.env.JWT_SECRET = 'component-test-jwt-secret';
process.env.ACCESS_TOKEN_EXPIRY = '15m';
process.env.REFRESH_TOKEN_EXPIRY = '7d';
process.env.DOMAIN_NAME = 'RWA Platform';
process.env.DOMAIN_VERSION = '1';

const JWT_SECRET = String(process.env.JWT_SECRET);
const ACCESS_TOKEN_EXPIRY = String(process.env.ACCESS_TOKEN_EXPIRY);
const REFRESH_TOKEN_EXPIRY = String(process.env.REFRESH_TOKEN_EXPIRY);
const DOMAIN_NAME = String(process.env.DOMAIN_NAME);
const DOMAIN_VERSION = String(process.env.DOMAIN_VERSION);

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

function buildApp(users: FakeUserRepository, refreshTokens: FakeRefreshTokenRepository) {
  const repositoriesPlugin = new Elysia({ name: 'Repositories' })
    .decorate('userRepository', users)
    .decorate('refreshTokenRepository', refreshTokens);

  const servicesPlugin = createServicesPlugin(
    repositoriesPlugin as unknown as RepositoriesPlugin,
    JWT_SECRET,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY,
    DOMAIN_NAME,
    DOMAIN_VERSION,
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

describe('auth HTTP layer (component, fake repositories)', () => {
  let users: FakeUserRepository;
  let refreshTokens: FakeRefreshTokenRepository;
  let app: App;

  beforeEach(() => {
    users = createFakeUserRepository();
    refreshTokens = createFakeRefreshTokenRepository();
    app = buildApp(users, refreshTokens);
  });

  test('authenticate → getUser → getUserTokens round-trip', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await post(app, '/authenticate', await signAuthMessage(wallet, nowSeconds()));

    expect(auth.status).toBe(200);
    expect(auth.body.wallet).toBe(wallet.address.toLowerCase());
    expect(typeof auth.body.userId).toBe('string');
    expect(typeof auth.body.accessToken).toBe('string');
    expect(typeof auth.body.refreshToken).toBe('string');
    expect(users.store.size).toBe(1);

    // The env-configured expiries are wired through the plugin into AuthService.
    const accessPayload = jwt.decode(auth.body.accessToken) as any;
    expect(accessPayload.type).toBe('access');
    expect(accessPayload.exp - accessPayload.iat).toBe(15 * 60);

    const user = await post(app, '/getUser', { userId: auth.body.userId });
    expect(user.status).toBe(200);
    expect(user.body).toMatchObject({ userId: auth.body.userId, wallet: wallet.address.toLowerCase() });
    expect(typeof user.body.createdAt).toBe('number');
    expect(typeof user.body.updatedAt).toBe('number');

    const tokens = await post(app, '/getUserTokens', { userId: auth.body.userId });
    expect(tokens.status).toBe(200);
    expect(tokens.body).toHaveLength(1);
    expect(tokens.body[0].userId).toBe(auth.body.userId);
    expect(tokens.body[0].tokenHash).toBe(sha256(auth.body.refreshToken));
  });

  test('authenticate: the same wallet is not duplicated on repeated sign-in', async () => {
    const wallet = ethers.Wallet.createRandom();

    const first = await post(app, '/authenticate', await signAuthMessage(wallet, nowSeconds()));
    const second = await post(app, '/authenticate', await signAuthMessage(wallet, nowSeconds()));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.userId).toBe(first.body.userId);
    expect(users.store.size).toBe(1);
  });

  test('authenticate: a signature from another wallet maps to 401 AUTHENTICATION_ERROR', async () => {
    const wallet = ethers.Wallet.createRandom();
    const impostor = ethers.Wallet.createRandom();
    const timestamp = nowSeconds();
    const signature = await impostor.signTypedData(
      AUTH_DOMAIN,
      { Message: AUTH_MESSAGE_TYPES },
      buildAuthMessage(wallet.address, timestamp),
    );

    const response = await post(app, '/authenticate', { wallet: wallet.address, signature, timestamp });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid signature' } });
    expect(users.findOrCreate).toHaveBeenCalledTimes(0);
    expect(refreshTokens.create).toHaveBeenCalledTimes(0);
  });

  test('authenticate: a timestamp outside the window maps to 401 AUTHENTICATION_ERROR', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await signAuthMessage(wallet, nowSeconds() - 120);

    const response = await post(app, '/authenticate', auth);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: 'AUTHENTICATION_ERROR', message: 'Timestamp is too far from server time' },
    });
    expect(users.findOrCreate).toHaveBeenCalledTimes(0);
  });

  test('authenticate: an invalid payload never reaches the repository', async () => {
    const response = await post(app, '/authenticate', { wallet: '0x123', timestamp: nowSeconds() });

    expect(response.status).not.toBe(200);
    expect(response.body.error).toBeDefined();
    expect(users.findOrCreate).toHaveBeenCalledTimes(0);
    expect(refreshTokens.create).toHaveBeenCalledTimes(0);
  });

  test('refreshToken: rotates the token pair and rejects reuse of the old one', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await post(app, '/authenticate', await signAuthMessage(wallet, nowSeconds()));

    const refreshed = await post(app, '/refreshToken', { refreshToken: auth.body.refreshToken });

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.userId).toBe(auth.body.userId);
    expect(refreshed.body.wallet).toBe(wallet.address.toLowerCase());
    expect(refreshed.body.accessToken).not.toBe(auth.body.accessToken);
    expect(refreshed.body.refreshToken).not.toBe(auth.body.refreshToken);

    // Only the rotated token remains stored, and it is stored hashed.
    const storedHashes = Array.from(refreshTokens.store.values()).map((token) => token.tokenHash);
    expect(storedHashes).toEqual([sha256(refreshed.body.refreshToken)]);

    const reuse = await post(app, '/refreshToken', { refreshToken: auth.body.refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body).toEqual({ error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid refresh token' } });
  });

  test('refreshToken: an access token maps to 401 Invalid token type', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await post(app, '/authenticate', await signAuthMessage(wallet, nowSeconds()));

    const response = await post(app, '/refreshToken', { refreshToken: auth.body.accessToken });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid token type' } });
    expect(refreshTokens.findByTokenHash).toHaveBeenCalledTimes(0);
  });

  test('refreshToken: a string that is not a JWT is rejected without a database lookup', async () => {
    const response = await post(app, '/refreshToken', { refreshToken: 'not-a-token' });

    expect(response.status).not.toBe(200);
    expect(response.body.error).toBeDefined();
    expect(refreshTokens.findByTokenHash).toHaveBeenCalledTimes(0);
    expect(refreshTokens.deleteTokens).toHaveBeenCalledTimes(0);
  });

  test('getUser: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/getUser', { userId: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'User unknown-id not found' } });
  });

  test('getUserTokens: a user without tokens returns an empty array', async () => {
    const response = await post(app, '/getUserTokens', { userId: 'user-without-tokens' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('revokeTokens: revokes only matching hashes and reports the count', async () => {
    const wallet = ethers.Wallet.createRandom();
    const auth = await post(app, '/authenticate', await signAuthMessage(wallet, nowSeconds()));
    const hash = sha256(auth.body.refreshToken);

    const revoked = await post(app, '/revokeTokens', {
      userId: auth.body.userId,
      tokenHashes: [hash, 'unknown-hash'],
    });

    expect(revoked.status).toBe(200);
    expect(revoked.body).toEqual({ revokedCount: 1 });
    expect(refreshTokens.store.size).toBe(0);

    const after = await post(app, '/getUserTokens', { userId: auth.body.userId });
    expect(after.status).toBe(200);
    expect(after.body).toEqual([]);
  });
});
