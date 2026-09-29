/**
 * In-memory fake of SignersManagerClient for unit tests.
 *
 * The real client only publishes requests and declares the responses topology
 * now (the consuming side lives in ReliableConsumer, which the daemon wires to
 * the fake RabbitMQ client directly). Tests use this fake to keep the service
 * and daemon layers isolated: no broker, no network, deterministic results.
 */
import { mock } from 'bun:test';
import type { SignatureResponse } from '../../src/clients/signersManager.client';

export function createFakeSignersManagerClient() {
  // Signatures pushed back to the manager through sendSignature().
  const sentSignatures: SignatureResponse[] = [];

  const client = {
    sentSignatures,

    initialize: mock(async (): Promise<void> => {}),

    sendSignature: mock(async (response: SignatureResponse): Promise<void> => {
      sentSignatures.push(response);
    }),

    requestsQueueName: () => 'sign.requests.0xtest',
  };

  return client;
}

export type FakeSignersManagerClient = ReturnType<typeof createFakeSignersManagerClient>;
