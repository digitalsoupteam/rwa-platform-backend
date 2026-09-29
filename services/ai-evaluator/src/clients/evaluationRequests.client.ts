import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { setupDlxRetryTopology } from '@shared/rabbitmq/src/reliability';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export interface EvaluationRequestMessage {
  entityType: 'pool' | 'business';
  entityId: string;
  ownerId: string;
  ownerType: string;
}

/** The queue evaluation requests land in; consumed through ReliableConsumer. */
export const EVALUATION_REQUESTS_QUEUE = 'evaluation.requests';
const REQUESTS_RETRY_DELAY_MS = 10_000;

export class EvaluationRequestsClient {
  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    // The queue gets the standard retry topology: failed requests are retried
    // through `evaluation.requests.retry` and parked in
    // `evaluation.requests.parked`. Both sides (this service and rwa) declare
    // the same arguments; queue arguments are immutable in RabbitMQ — an
    // existing environment must recreate `evaluation.requests` once before
    // starting the new version.
    await setupDlxRetryTopology(this.rabbitClient, EVALUATION_REQUESTS_QUEUE, REQUESTS_RETRY_DELAY_MS);
  }
}
