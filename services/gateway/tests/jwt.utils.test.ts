/**
 * Unit tests for the gateway JWT helpers (src/utils/jwt.utils.ts).
 *
 * CONFIG reads process.env.JWT_SECRET at import time, so the env var is set
 * before the module under test is imported (dynamic import below).
 * No network, no database — pure functions.
 */
import { describe, expect, test } from 'bun:test';
import * as jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = TEST_SECRET;

const { verifyToken, decodeToken, isTokenExpired, extractFromToken } = await import('../src/utils/jwt.utils');

const NOW = Math.floor(Date.now() / 1000);
const basePayload = { userId: 'user-1', wallet: '0xabc', type: 'access' as const };

const signAccess = (extra: Record<string, unknown> = {}) =>
  jwt.sign({ ...basePayload, ...extra }, TEST_SECRET, { expiresIn: 900 });

describe('gateway jwt utils', () => {
  test('verifyToken: returns the decoded payload for a valid token', () => {
    const decoded = verifyToken(signAccess());

    expect(decoded).toMatchObject(basePayload);
    expect(decoded?.exp).toBeGreaterThan(NOW);
  });

  test('verifyToken: returns null for a token signed with a different secret', () => {
    const token = jwt.sign(basePayload, 'other-secret', { expiresIn: 900 });

    expect(verifyToken(token)).toBeNull();
  });

  test('verifyToken: returns null for an expired token', () => {
    const token = jwt.sign({ ...basePayload, exp: NOW - 10 }, TEST_SECRET);

    expect(verifyToken(token)).toBeNull();
  });

  test('verifyToken: returns null for malformed input', () => {
    expect(verifyToken('not-a-token')).toBeNull();
  });

  test('decodeToken: parses the payload without verifying the signature', () => {
    const token = jwt.sign(basePayload, 'any-secret');

    expect(decodeToken(token)).toMatchObject(basePayload);
  });

  test('decodeToken: returns null for malformed tokens', () => {
    expect(decodeToken('not-a-token')).toBeNull();
    expect(decodeToken('a.b')).toBeNull();
  });

  test('isTokenExpired: reflects exp vs now, and treats missing exp as expired', () => {
    expect(isTokenExpired({ exp: NOW + 100 })).toBe(false);
    expect(isTokenExpired({ exp: NOW - 1 })).toBe(true);
    expect(isTokenExpired({} as never)).toBe(true);
  });

  test('extractFromToken: returns user data for a valid access token', () => {
    expect(extractFromToken(signAccess())).toEqual({ userId: 'user-1', wallet: '0xabc' });
  });

  test('extractFromToken: returns null for a refresh token', () => {
    expect(extractFromToken(signAccess({ type: 'refresh' }))).toBeNull();
  });

  test('extractFromToken: returns null when userId or wallet is missing', () => {
    const noUserId = jwt.sign({ wallet: '0xabc', type: 'access' }, TEST_SECRET, { expiresIn: 900 });
    const noWallet = jwt.sign({ userId: 'user-1', type: 'access' }, TEST_SECRET, { expiresIn: 900 });

    expect(extractFromToken(noUserId)).toBeNull();
    expect(extractFromToken(noWallet)).toBeNull();
  });

  test('extractFromToken: returns null for invalid tokens', () => {
    expect(extractFromToken('garbage')).toBeNull();
  });
});
