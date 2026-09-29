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

/** The queue evaluation results land in; consumed through ReliableConsumer. */
export const EVALUATION_RESULTS_QUEUE = 'evaluation.results';
const RESULTS_RETRY_DELAY_MS = 10_000;

export class EvaluationResultsClient {
  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    // The queue gets the standard retry topology: failed results are retried
    // through `evaluation.results.retry` and parked in `evaluation.results.parked`.
    // Both sides (this service and ai-evaluator) declare the same arguments;
    // queue arguments are immutable in RabbitMQ — an existing environment must
    // recreate `evaluation.results` once before starting the new version.
    await setupDlxRetryTopology(this.rabbitClient, EVALUATION_RESULTS_QUEUE, RESULTS_RETRY_DELAY_MS);
  }
}
