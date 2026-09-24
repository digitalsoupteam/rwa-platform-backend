/**
 * In-memory fake of RabbitMQClient for unit tests.
 *
 * The real client owns an amqp-connection-manager connection and channel. Tests
 * use this fake to keep the client and daemon layers isolated: no broker, no
 * network, deterministic acknowledgements. The public API mirrors
 * shared/rabbitmq/src/rabbitmq.client.ts, and every method is wrapped in
 * bun:test mock() so interactions can be asserted.
 *
 * consume() additionally records the registered consumer (queue, handler,
 * options) and exposes it through getConsumer(), so a test can drive the handler
 * with synthetic amqplib messages without a broker.
 */
import { mock } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';

export type FakeConsumer = {
  queue: string;
  handler: (message: ConsumeMessage | null) => Promise<void>;
  options?: { noAck?: boolean; prefetch?: number };
};

export function createFakeRabbitMQClient() {
  let consumer: FakeConsumer | null = null;

  const client = {
    connect: mock(async (): Promise<void> => {}),

    disconnect: mock(async (): Promise<void> => {}),

    setupQueue: mock(async (_queue: string, _options?: any): Promise<void> => {}),

    setupExchange: mock(async (_exchange: string, _type: string, _options?: any): Promise<void> => {}),

    bindQueue: mock(async (_queue: string, _exchange: string, _pattern: string): Promise<void> => {}),

    publish: mock(async (_exchange: string, _routingKey: string, _content: any, _options?: any): Promise<void> => {}),

    sendToQueue: mock(async (_queue: string, _content: any, _options?: any): Promise<void> => {}),

    consume: mock(
      async (
        queue: string,
        handler: (message: ConsumeMessage | null) => Promise<void>,
        options?: { noAck?: boolean; prefetch?: number },
      ): Promise<void> => {
        consumer = { queue, handler, options };
      },
    ),

    ack: mock(async (_message: ConsumeMessage): Promise<void> => {}),

    nack: mock(async (_message: ConsumeMessage, _requeue = true): Promise<void> => {}),

    /** Consumer registered through consume(), so tests can invoke the handler directly. */
    getConsumer(): FakeConsumer | null {
      return consumer;
    },
  };

  return client;
}

export type FakeRabbitMQClient = ReturnType<typeof createFakeRabbitMQClient>;

/**
 * Builds a synthetic amqplib message as delivered by the broker. Passing a string
 * sends it as the raw body (useful for malformed-payload tests), any other value
 * is JSON stringified like the producers of evaluation.requests do.
 */
export function createConsumeMessage(body: unknown, routingKey = 'evaluation.requests'): ConsumeMessage {
  const content = typeof body === 'string' ? body : JSON.stringify(body);

  return {
    content: Buffer.from(content),
    fields: {
      consumerTag: 'test-consumer',
      deliveryTag: 1,
      redelivered: false,
      exchange: '',
      routingKey,
    },
    properties: { contentType: 'application/json' },
  } as unknown as ConsumeMessage;
}
