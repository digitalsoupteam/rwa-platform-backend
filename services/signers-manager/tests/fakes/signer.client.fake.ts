/**
 * In-memory fake of SignerClient for unit tests.
 *
 * The real client publishes requests to a RabbitMQ fanout exchange and declares
 * the responses topology (the consuming side lives in ReliableConsumer, wired
 * by the daemon to the fake RabbitMQ client directly). Tests use this fake to
 * keep the service layer isolated: no broker, no network, deterministic
 * results.
 */
import { mock } from 'bun:test';
import type { SignatureRequest } from '../../src/clients/signer.client';

export function createFakeSignerClient() {
  // Signature requests pushed to the signers through sendSignatureTask().
  const sentRequests: SignatureRequest[] = [];

  const client = {
    sentRequests,

    initialize: mock(async (): Promise<void> => {}),

    sendSignatureTask: mock(async (request: SignatureRequest): Promise<void> => {
      sentRequests.push(request);
    }),
  };

  return client;
}

export type FakeSignerClient = ReturnType<typeof createFakeSignerClient>;
