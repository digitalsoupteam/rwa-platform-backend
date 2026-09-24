/**
 * In-memory fake of EvaluationResultsClient
 * (src/clients/evaluationResults.client.ts).
 *
 * The real client consumes the `evaluation.results` rabbit queue; this fake
 * captures the handler passed to consumeResults() so tests can invoke it with
 * a synthetic amqplib message, and mirrors ackMessage/nackMessage with mocks.
 */
import { mock } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';

export function createFakeEvaluationResultsClient() {
  let consumeHandler: ((message: ConsumeMessage | null) => Promise<void>) | null = null;

  return {
    initialize: mock(async (): Promise<void> => {}),

    consumeResults: mock(async (handler: (message: ConsumeMessage | null) => Promise<void>): Promise<void> => {
      consumeHandler = handler;
    }),

    ackMessage: mock(async (_message: ConsumeMessage): Promise<void> => {}),

    nackMessage: mock(async (_message: ConsumeMessage, _requeue: boolean = true): Promise<void> => {}),

    // Handler registered through consumeResults(); the daemon registers its own
    // bound handler during initialize().
    getConsumeHandler() {
      if (!consumeHandler) throw new Error('consumeResults() has not registered a handler yet');
      return consumeHandler;
    },
  };
}

export type FakeEvaluationResultsClient = ReturnType<typeof createFakeEvaluationResultsClient>;
