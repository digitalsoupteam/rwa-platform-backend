/**
 * In-memory fake of RabbitMQClient for daemon tests.
 *
 * The real client talks to a broker through amqp-connection-manager. Tests use
 * this fake to keep the daemon isolated: nothing connects, nothing reaches a
 * broker, and every interaction stays observable. The public API mirrors
 * shared/rabbitmq/src/rabbitmq.client.ts, and every method is wrapped in
 * bun:test mock() so interactions can be asserted.
 *
 * The consume callback registered by the daemon is captured so tests can feed
 * it synthetic messages (`consumerFor(queue)`).
 */
import { mock } from 'bun:test';

/** Structural stand-in for amqplib's ConsumeMessage (only the parts the daemon reads). */
export type FakeConsumeMessage = {
  content: Buffer;
  fields: Record<string, unknown>;
  properties: { headers?: Record<string, unknown> };
};

export type FakeConsumer = {
  queue: string;
  handler: (message: FakeConsumeMessage | null) => Promise<void>;
  options: { noAck?: boolean; prefetch?: number } | undefined;
};

export type FakePublish = {
  exchange: string;
  routingKey: string;
  content: unknown;
  buffer: Buffer;
};

export function createFakeRabbitMQClient() {
  const published: FakePublish[] = [];
  const sentToQueue: Array<{ queue: string; content: unknown }> = [];
  const exchanges: Array<{ exchange: string; type: string; options?: unknown }> = [];
  const queues: Array<{ queue: string; options?: unknown }> = [];
  const bindings: Array<{ queue: string; exchange: string; pattern: string }> = [];
  const consumers: FakeConsumer[] = [];
  const acked: FakeConsumeMessage[] = [];
  const nacked: Array<{ message: FakeConsumeMessage; requeue: boolean }> = [];

  const client = {
    published,
    sentToQueue,
    exchanges,
    queues,
    bindings,
    consumers,
    acked,
    nacked,

    connect: mock(async (): Promise<void> => {}),

    disconnect: mock(async (): Promise<void> => {}),

    setupQueue: mock(async (queue: string, options?: unknown): Promise<void> => {
      queues.push({ queue, options });
    }),

    setupExchange: mock(async (exchange: string, type: string, options?: unknown): Promise<void> => {
      exchanges.push({ exchange, type, options });
    }),

    bindQueue: mock(async (queue: string, exchange: string, pattern: string): Promise<void> => {
      bindings.push({ queue, exchange, pattern });
    }),

    publish: mock(async (exchange: string, routingKey: string, content: unknown, options?: unknown): Promise<void> => {
      published.push({ exchange, routingKey, content, buffer: Buffer.from(JSON.stringify(content)) });
    }),

    sendToQueue: mock(async (queue: string, content: unknown, options?: unknown): Promise<void> => {
      sentToQueue.push({ queue, content });
    }),

    consume: mock(
      async (
        queue: string,
        handler: (message: FakeConsumeMessage | null) => Promise<void>,
        options?: { noAck?: boolean; prefetch?: number },
      ): Promise<void> => {
        consumers.push({ queue, handler, options });
      },
    ),

    ack: mock(async (message: FakeConsumeMessage): Promise<void> => {
      acked.push(message);
    }),

    nack: mock(async (message: FakeConsumeMessage, requeue: boolean = true): Promise<void> => {
      nacked.push({ message, requeue });
    }),
  };

  /** Consumer callback the daemon registered for a queue, if any. */
  const consumerFor = (queue: string) => consumers.find((consumer) => consumer.queue === queue)?.handler;

  return { ...client, consumerFor };
}

export type FakeRabbitMQClient = ReturnType<typeof createFakeRabbitMQClient>;
