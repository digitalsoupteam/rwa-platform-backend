/**
 * In-memory fake of RabbitMQClient for unit tests.
 *
 * The real client owns an amqp-connection-manager connection and runs every
 * exchange/queue/binding setup against the broker. Tests use this fake to keep
 * the daemon layer isolated: nothing connects, no broker is needed, and every
 * call is recorded. The public API mirrors
 * shared/rabbitmq/src/rabbitmq.client.ts, and every method is wrapped in
 * bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';

export type FakeConsumeMessage = {
  content: Buffer;
  properties?: { headers?: Record<string, unknown> };
};

export function createFakeRabbitMQClient() {
  // queue -> consumer callback registered through consume()
  const consumers = new Map<string, (message: FakeConsumeMessage | null) => Promise<void>>();
  const published: Array<{ exchange: string; routingKey: string; content: unknown }> = [];
  const sentToQueue: Array<{ queue: string; content: unknown }> = [];
  const acked: FakeConsumeMessage[] = [];
  const nacked: Array<{ message: FakeConsumeMessage; requeue: boolean }> = [];

  const client = {
    consumers,
    published,
    sentToQueue,
    acked,
    nacked,

    connect: mock(async (): Promise<void> => {}),

    disconnect: mock(async (): Promise<void> => {}),

    setupExchange: mock(async (_exchange: string, _type: string, _options?: unknown): Promise<void> => {}),

    setupQueue: mock(async (_queue: string, _options?: unknown): Promise<void> => {}),

    bindQueue: mock(async (_queue: string, _exchange: string, _pattern: string): Promise<void> => {}),

    publish: mock(
      async (exchange: string, routingKey: string, content: unknown, _options?: unknown): Promise<void> => {
        published.push({ exchange, routingKey, content });
      },
    ),

    sendToQueue: mock(async (queue: string, content: unknown, _options?: unknown): Promise<void> => {
      sentToQueue.push({ queue, content });
    }),

    consume: mock(
      async (
        queue: string,
        handler: (message: FakeConsumeMessage | null) => Promise<void>,
        _options?: { noAck?: boolean; prefetch?: number },
      ): Promise<void> => {
        consumers.set(queue, handler);
      },
    ),

    ack: mock(async (message: FakeConsumeMessage): Promise<void> => {
      acked.push(message);
    }),

    nack: mock(async (message: FakeConsumeMessage, requeue = true): Promise<void> => {
      nacked.push({ message, requeue });
    }),
  };

  return client;
}

export type FakeRabbitMQClient = ReturnType<typeof createFakeRabbitMQClient>;
