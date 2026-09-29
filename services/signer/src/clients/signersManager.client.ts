import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { setupDlxRetryTopology } from '@shared/rabbitmq/src/reliability';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export interface SignatureResponse {
  taskId: string;
  signer: string;
  hash: string;
  signature: string;
}

/** The queue signature responses are sent through; consumed by the manager. */
export const SIGN_RESPONSES_QUEUE = 'sign.responses';
const RESPONSES_RETRY_DELAY_MS = 10_000;

export class SignersManagerClient {
  private readonly SIGN_EXCHANGE = 'sign.exchange';
  private readonly REQUESTS_QUEUE: string;

  constructor(
    private readonly rabbitClient: RabbitMQClient,
    signerAddress: string,
  ) {
    // Durable per-signer queue: a request sent while this signer is down stays
    // in the queue and is processed after it comes back (until the TTL kicks in).
    this.REQUESTS_QUEUE = `sign.requests.${signerAddress.toLowerCase()}`;
  }

  @TraceDecorator()
  async initialize(): Promise<void> {
    // Setup exchange
    await this.rabbitClient.setupExchange(this.SIGN_EXCHANGE, 'fanout', {
      durable: true,
    });

    // Setup per-signer requests queue
    await this.rabbitClient.setupQueue(this.REQUESTS_QUEUE, {
      durable: true,
      arguments: {
        'x-message-ttl': 900000, // 15 minutes - requests are useless after the signing window
      },
    });
    await this.rabbitClient.bindQueue(this.REQUESTS_QUEUE, this.SIGN_EXCHANGE, '');

    // Setup responses queue: the 1h TTL stays, and failed responses are
    // retried through the standard retry topology (`sign.responses.retry`)
    // before being parked in `sign.responses.parked`. Both sides (this service
    // and the manager) declare the same arguments; queue arguments are
    // immutable in RabbitMQ — an existing environment must recreate
    // `sign.responses` once before starting the new version.
    await setupDlxRetryTopology(this.rabbitClient, SIGN_RESPONSES_QUEUE, RESPONSES_RETRY_DELAY_MS, {
      'x-message-ttl': 3600000, // 1 hour
    });
  }

  /**
   * Send signature response back to the manager
   */
  @TraceDecorator()
  async sendSignature(response: SignatureResponse): Promise<void> {
    await this.rabbitClient.sendToQueue(SIGN_RESPONSES_QUEUE, response);
  }

  /** The per-signer requests queue the daemon consumes through ReliableConsumer. */
  requestsQueueName(): string {
    return this.REQUESTS_QUEUE;
  }
}
