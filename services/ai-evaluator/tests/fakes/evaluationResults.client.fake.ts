/**
 * In-memory fake of EvaluationResultsClient for unit tests.
 *
 * The real client wraps a RabbitMQClient and publishes to the
 * `evaluation.results` queue. Tests use this fake to keep the service layer
 * isolated: no broker, no network. The public API mirrors
 * src/clients/evaluationResults.client.ts, and every method is wrapped in
 * bun:test mock() so interactions can be asserted.
 *
 * Published payloads are also collected in `published`, so a test can assert the
 * exact sequence of completed/failed publications without digging into mock calls.
 */
import { mock } from 'bun:test';
import type { EvaluationResultMessage } from '../src/clients/evaluationResults.client';

export function createFakeEvaluationResultsClient() {
  const published: EvaluationResultMessage[] = [];

  const client = {
    published,

    initialize: mock(async (): Promise<void> => {}),

    publishEvaluationResult: mock(async (result: EvaluationResultMessage): Promise<void> => {
      published.push(result);
    }),
  };

  return client;
}

export type FakeEvaluationResultsClient = ReturnType<typeof createFakeEvaluationResultsClient>;
