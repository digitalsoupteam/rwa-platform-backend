/**
 * In-memory fake of SignersManagerClient for unit tests.
 *
 * The real client publishes to and consumes from RabbitMQ. Tests use this fake
 * to keep the service and daemon layers isolated: no broker, no network,
 * deterministic results. The public API mirrors
 * src/clients/signersManager.client.ts; consumeRequests captures the consumer
 * callback so tests can drive the daemon the way the broker would, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';
import type { SignatureResponse } from '../../src/clients/signersManager.client';

export function createFakeSignersManagerClient() {
  // Signatures pushed back to the manager through sendSignature().
  const sentSignatures: SignatureResponse[] = [];
  // Messages acknowledged / negatively acknowledged through ackMessage()/nackMessage().
  const acked: ConsumeMessage[] = [];
  const nacked: { message: ConsumeMessage; requeue: boolean }[] = [];

  // The callback registered via consumeRequests(), kept verbatim for the test.
  let captured: ((msg: ConsumeMessage | null) => Promise<void>) | null = null;

  const client = {
    sentSignatures,
    acked,
    nacked,

    get capturedHandler(): ((msg: ConsumeMessage | null) => Promise<void>) | null {
      return captured;
    },

    initialize: mock(async (): Promise<void> => {}),

    sendSignature: mock(async (response: SignatureResponse): Promise<void> => {
      sentSignatures.push(response);
    }),

    consumeRequests: mock(async (handler: (msg: ConsumeMessage | null) => Promise<void>): Promise<void> => {
      captured = handler;
    }),

    ackMessage: mock(async (message: ConsumeMessage): Promise<void> => {
      acked.push(message);
    }),

    nackMessage: mock(async (message: ConsumeMessage, requeue: boolean = true): Promise<void> => {
      nacked.push({ message, requeue });
    }),
  };

  return client;
}

export type FakeSignersManagerClient = ReturnType<typeof createFakeSignersManagerClient>;
