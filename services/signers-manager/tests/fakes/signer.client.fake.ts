/**
 * In-memory fake of SignerClient for unit tests.
 *
 * The real client publishes requests to a RabbitMQ fanout exchange and consumes
 * responses from a queue. The fake records every call as a bun:test mock and
 * captures the handler passed to consumeResponses, so daemon tests can drive it
 * with synthetic amqplib messages. No broker is involved.
 */
import { mock } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';
import type { SignatureRequest } from '../../src/clients/signer.client';

export function createFakeSignerClient() {
  let responsesHandler: ((message: ConsumeMessage | null) => Promise<void>) | null = null;

  const client = {
    sendSignatureTask: mock(async (_request: SignatureRequest): Promise<void> => {}),

    initialize: mock(async (): Promise<void> => {}),

    consumeResponses: mock(async (handler: (message: ConsumeMessage | null) => Promise<void>): Promise<void> => {
      responsesHandler = handler;
    }),

    ackMessage: mock(async (_message: ConsumeMessage): Promise<void> => {}),

    nackMessage: mock(async (_message: ConsumeMessage, _requeue: boolean = true): Promise<void> => {}),

    /** Handler registered through consumeResponses (null until it has been called). */
    getResponsesHandler: () => responsesHandler,
  };

  return client;
}

export type FakeSignerClient = ReturnType<typeof createFakeSignerClient>;
