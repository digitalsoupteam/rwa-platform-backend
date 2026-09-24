/**
 * Unit tests for SignatureService.
 *
 * Scope: the service layer only. The signers-manager client is replaced with an
 * in-memory fake (tests/fakes/signersManager.client.fake.ts); the wallet is real
 * but deterministic — a well-known throwaway test key, so there is no RPC, no
 * broker and no network anywhere in this file. Run with `bun test` from
 * services/signer.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { ethers } from 'ethers';
import { AppError } from '@shared/errors/app-errors';
import { SignatureService } from '../src/services/signature.service';
import type { SignersManagerClient } from '../src/clients/signersManager.client';
import { createFakeSignersManagerClient, type FakeSignersManagerClient } from './fakes/signersManager.client.fake';

// Well-known throwaway key (dev account #0) — a deterministic signer, no secrets.
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const SIGNER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

// 32-byte hex hash — the only shape the manager sends (the daemon regex-gates fields).
const HASH = `0x${'11'.repeat(32)}`;
const TASK_ID = 'task-42';

// Fixed deadlines keep the tests independent of the wall clock. The expiry check
// is `expired < now` (strict), so equality is deliberately not asserted: a
// live-clock equality test would be racy, while both sides of the boundary are
// covered here with wide margins.
const FUTURE_EXPIRED = 4102444800; // 2100-01-01T00:00:00Z
const PAST_EXPIRED = 1000000000; // 2001-09-09T01:46:40Z

describe('SignatureService (unit, fake signers-manager client)', () => {
  let manager: FakeSignersManagerClient;
  let service: SignatureService;

  beforeEach(() => {
    manager = createFakeSignersManagerClient();
    service = new SignatureService(manager as unknown as SignersManagerClient, PRIVATE_KEY);
  });

  test('getSignerAddress: returns the address derived from the configured private key', () => {
    expect(service.getSignerAddress()).toBe(SIGNER_ADDRESS);
  });

  test('signHash: signs the hash with the wallet and returns only { signer, signature }', async () => {
    const result = await service.signHash(HASH, TASK_ID, FUTURE_EXPIRED);

    expect(result.signer).toBe(SIGNER_ADDRESS);
    expect(result.signature).toMatch(/^0x[0-9a-f]{130}$/i); // 65-byte ECDSA signature
    // The signature must recover to the signer for exactly the bytes that were signed.
    expect(ethers.verifyMessage(ethers.getBytes(HASH), result.signature)).toBe(SIGNER_ADDRESS);
    // Plain JSON result — nothing but the two strings, nothing leaking to the caller.
    expect(Object.keys(result).sort()).toEqual(['signature', 'signer']);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  test('signHash: sends the signature back through the manager client with the exact payload', async () => {
    const result = await service.signHash(HASH, TASK_ID, FUTURE_EXPIRED);

    expect(manager.sendSignature).toHaveBeenCalledTimes(1);
    expect(manager.sendSignature).toHaveBeenCalledWith({
      taskId: TASK_ID,
      signer: SIGNER_ADDRESS,
      hash: HASH,
      signature: result.signature,
    });
  });

  test('signHash: throws EXPIRED (410) when the deadline has passed and sends nothing', async () => {
    const error = await service.signHash(HASH, TASK_ID, PAST_EXPIRED).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ message: 'Task expired', statusCode: 410, code: 'EXPIRED' });
    expect(manager.sendSignature).toHaveBeenCalledTimes(0);
  });

  test('signHash: a hash that is not hex is rejected by ethers before anything is sent', async () => {
    // The service does not validate the hash format itself — that gate lives in the
    // daemon (src/daemons/signature.daemon.ts). A non-hex value reaches
    // ethers.getBytes() and fails there with a plain error, not an AppError.
    const error = await service.signHash('not-a-hex-hash', TASK_ID, FUTURE_EXPIRED).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AppError);
    expect(manager.sendSignature).toHaveBeenCalledTimes(0);
  });

  test('signHash: does not enforce the 32-byte hash length (that check lives in the daemon)', async () => {
    // '0x1234' is well-formed hex but only 2 bytes. ethers signs whatever bytes it
    // is given, so the service signs and forwards it — the daemon's
    // /^0x[0-9a-f]{64}$/i guard is the only length check on the signing path.
    const result = await service.signHash('0x1234', TASK_ID, FUTURE_EXPIRED);

    expect(result.signature).toMatch(/^0x[0-9a-f]{130}$/i);
    expect(ethers.verifyMessage(ethers.getBytes('0x1234'), result.signature)).toBe(SIGNER_ADDRESS);
    expect(manager.sendSignature).toHaveBeenCalledTimes(1);
    expect(manager.sendSignature).toHaveBeenCalledWith({
      taskId: TASK_ID,
      signer: SIGNER_ADDRESS,
      hash: '0x1234',
      signature: result.signature,
    });
  });
});
