/**
 * In-memory fake of EvaluationRequestsClient
 * (src/clients/evaluationRequests.client.ts).
 *
 * The real client publishes messages to the `evaluation.requests` rabbit
 * queue; this fake records calls with bun:test mock() and never touches a
 * broker.
 */
import { mock } from 'bun:test';

export function createFakeEvaluationRequestsClient() {
  return {
    initialize: mock(async (): Promise<void> => {}),

    publishEvaluationRequest: mock(
      async (_method: 'evaluatePool' | 'evaluateBusiness', _args: Record<string, unknown>): Promise<void> => {},
    ),
  };
}

export type FakeEvaluationRequestsClient = ReturnType<typeof createFakeEvaluationRequestsClient>;
