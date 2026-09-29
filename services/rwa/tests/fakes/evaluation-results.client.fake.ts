/**
 * In-memory fake of EvaluationResultsClient
 * (src/clients/evaluationResults.client.ts).
 *
 * The client only declares the queue topology now; the consumer side lives in
 * ReliableConsumer (wired by the daemon to the fake RabbitMQ client directly),
 * so the fake just satisfies the plugin decorators and keep-alive wiring.
 */
import { mock } from 'bun:test';

export function createFakeEvaluationResultsClient() {
  return {
    initialize: mock(async (): Promise<void> => {}),
  };
}

export type FakeEvaluationResultsClient = ReturnType<typeof createFakeEvaluationResultsClient>;
