/**
 * In-memory fake of RabbitMQClient for daemon tests.
 *
 * The real client owns an amqp-connection-manager connection and channel.
 * Tests use this fake to keep the daemon isolated: no broker, no network.
 * The public API mirrors shared/rabbitmq/src/rabbitmq.client.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 *
 * consume() records the registered handler per queue; a test can pick it up
 * with consumerFor(queue) and feed it a synthetic message built with
 * buildMessage().
 */
import { mock } from 'bun:test';

export type FakeConsumeMessage = {
  content: Buffer;
  properties?: { headers?: Record<string, unknown> };
};

export type FakeConsumeHandler = (message: FakeConsumeMessage | null) => Promise<void>;

export function createFakeRabbitMQClient() {
  const consumers = new Map<string, FakeConsumeHandler>();
  const state = { connected: false };

  const client = {
    state,
    consumers,

    consumerFor: (queue: string) => consumers.get(queue),

    connect: mock(async () => {
      state.connected = true;
    }),

    disconnect: mock(async () => {
      state.connected = false;
    }),

    setupExchange: mock(async (_exchange: string, _type: string, _options?: unknown) => {}),

    setupQueue: mock(async (_queue: string, _options?: unknown) => {}),

    bindQueue: mock(async (_queue: string, _exchange: string, _pattern: string) => {}),

    publish: mock(async (_exchange: string, _routingKey: string, _content: unknown, _options?: unknown) => {}),

    sendToQueue: mock(async (_queue: string, _content: unknown, _options?: unknown) => {}),

    consume: mock(
      async (
        queue: string,
        handler: FakeConsumeHandler,
        _options?: { noAck?: boolean; prefetch?: number },
      ) => {
        consumers.set(queue, handler);
      },
    ),

    ack: mock(async (_message: FakeConsumeMessage) => {}),

    nack: mock(async (_message: FakeConsumeMessage, _requeue: boolean = true) => {}),

    /** Builds a synthetic ConsumeMessage-like object around raw bytes or a JSON payload. */
    buildMessage(payload: unknown): FakeConsumeMessage {
      const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
      return { content: Buffer.from(raw), properties: { headers: {} } };
    },
  };

  return client;
}

export type FakeRabbitMQClient = ReturnType<typeof createFakeRabbitMQClient>;
