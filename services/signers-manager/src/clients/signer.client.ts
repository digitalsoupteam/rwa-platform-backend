import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { setupDlxRetryTopology } from '@shared/rabbitmq/src/reliability';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export interface SignatureRequest {
  hash: string;
  taskId: string;
  expired: number;
}

/** The queue signer responses land in; consumed through ReliableConsumer. */
export const SIGN_RESPONSES_QUEUE = 'sign.responses';
const RESPONSES_RETRY_DELAY_MS = 10_000;

export class SignerClient {
  private readonly SIGN_EXCHANGE = 'sign.exchange';

  constructor(private readonly rabbitClient: RabbitMQClient) {}

  @TraceDecorator()
  async initialize(): Promise<void> {
    // Setup exchange
    await this.rabbitClient.setupExchange(this.SIGN_EXCHANGE, 'fanout', {
      durable: true,
    });

    // Setup the responses queue: the 1h TTL stays, and failed responses are
    // retried through the standard retry topology (`sign.responses.retry`)
    // before being parked in `sign.responses.parked`. Both sides (this service
    // and the signer) declare the same arguments; queue arguments are immutable
    // in RabbitMQ — an existing environment must recreate `sign.responses` once
    // before starting the new version.
    await setupDlxRetryTopology(this.rabbitClient, SIGN_RESPONSES_QUEUE, RESPONSES_RETRY_DELAY_MS, {
      'x-message-ttl': 3600000, // 1 hour
    });
  }

  /**
   * Send signature request to signers
   */
  @TraceDecorator()
  async sendSignatureTask(request: SignatureRequest): Promise<void> {
    await this.rabbitClient.publish(this.SIGN_EXCHANGE, '', request);
  }
}
