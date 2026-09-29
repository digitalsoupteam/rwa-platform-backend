import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { setupDlxRetryTopology } from '@shared/rabbitmq/src/reliability';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export interface EvaluationResultMessage {
  evaluationId: string;
  entityType: string;
  entityId: string;
  status: 'completed' | 'failed';
  riskScore?: number;
}

/** The queue evaluation results land in; consumed by the rwa service. */
export const EVALUATION_RESULTS_QUEUE = 'evaluation.results';
const RESULTS_RETRY_DELAY_MS = 10_000;

export class EvaluationResultsClient {
  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    // Both sides (this service and rwa) declare the same arguments, including
    // the retry topology the rwa consumer relies on.
    await setupDlxRetryTopology(this.rabbitClient, EVALUATION_RESULTS_QUEUE, RESULTS_RETRY_DELAY_MS);
  }

  @TraceDecorator()
  async publishEvaluationResult(result: EvaluationResultMessage): Promise<void> {
    await this.rabbitClient.sendToQueue(EVALUATION_RESULTS_QUEUE, result);
  }
}
