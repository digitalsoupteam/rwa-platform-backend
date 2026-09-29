/**
 * In-memory fake of EvaluationRequestsClient for unit tests.
 *
 * The client only declares the queue topology now; the consumer side lives in
 * ReliableConsumer (wired by the daemon to the fake RabbitMQ client directly),
 * so the fake just satisfies the plugin decorators.
 */
import { mock } from 'bun:test';

export function createFakeEvaluationRequestsClient() {
  return {
    initialize: mock(async (): Promise<void> => {}),
  };
}

export type FakeEvaluationRequestsClient = ReturnType<typeof createFakeEvaluationRequestsClient>;
