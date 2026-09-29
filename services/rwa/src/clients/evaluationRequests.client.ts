import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { setupDlxRetryTopology } from '@shared/rabbitmq/src/reliability';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

/** The queue evaluation requests land in; consumed by the ai-evaluator service. */
export const EVALUATION_REQUESTS_QUEUE = 'evaluation.requests';
const REQUESTS_RETRY_DELAY_MS = 10_000;

export class EvaluationRequestsClient {
  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    // Both sides (this service and ai-evaluator) declare the same arguments,
    // including the retry topology the ai-evaluator consumer relies on.
    await setupDlxRetryTopology(this.rabbitClient, EVALUATION_REQUESTS_QUEUE, REQUESTS_RETRY_DELAY_MS);
  }

  @TraceDecorator()
  async publishEvaluationRequest(
    method: 'evaluatePool' | 'evaluateBusiness',
    args: Record<string, unknown>,
  ): Promise<void> {
    await this.rabbitClient.sendToQueue(EVALUATION_REQUESTS_QUEUE, { method, args });
  }
}
