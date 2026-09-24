/**
 * In-memory fake of EvaluationRequestsClient for unit tests.
 *
 * The real client wraps a RabbitMQClient and owns the `evaluation.requests`
 * queue. Tests use this fake to keep the daemon isolated: no broker, no
 * network. The public API mirrors src/clients/evaluationRequests.client.ts, and
 * every method is wrapped in bun:test mock() so interactions can be asserted.
 *
 * consumeRequests() records the handler the daemon registers; getHandler()
 * exposes it so tests can drive the daemon with synthetic amqplib messages.
 */
import { mock } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';

export function createFakeEvaluationRequestsClient() {
  let capturedHandler: ((message: ConsumeMessage | null) => Promise<void>) | null = null;

  const client = {
    initialize: mock(async (): Promise<void> => {}),

    consumeRequests: mock(async (handler: (message: ConsumeMessage | null) => Promise<void>): Promise<void> => {
      capturedHandler = handler;
    }),

    ackMessage: mock(async (_message: ConsumeMessage): Promise<void> => {}),

    nackMessage: mock(async (_message: ConsumeMessage, _requeue = true): Promise<void> => {}),

    /** Handler registered through consumeRequests(). */
    getHandler(): ((message: ConsumeMessage | null) => Promise<void>) | null {
      return capturedHandler;
    },
  };

  return client;
}

export type FakeEvaluationRequestsClient = ReturnType<typeof createFakeEvaluationRequestsClient>;
