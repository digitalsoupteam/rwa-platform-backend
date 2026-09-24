/**
 * In-memory fake of RabbitMQClient for unit tests.
 *
 * Mirrors the public API of shared/rabbitmq/src/rabbitmq.client.ts without
 * touching amqp-connection-manager: every method is a bun:test mock, consumed
 * handlers are captured per queue, and `callLog` preserves invocation order.
 */
import { mock } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';

export function createFakeRabbitMQClient() {
  const callLog: string[] = [];
  const consumedHandlers = new Map<string, (message: ConsumeMessage | null) => Promise<void>>();

  const client = {
    callLog,
    consumedHandlers,

    connect: mock(async (): Promise<void> => {
      callLog.push('connect');
    }),

    disconnect: mock(async (): Promise<void> => {
      callLog.push('disconnect');
    }),

    setupQueue: mock(async (_queue: string, _options?: unknown): Promise<void> => {
      callLog.push('setupQueue');
    }),

    setupExchange: mock(async (_exchange: string, _type: string, _options?: unknown): Promise<void> => {
      callLog.push('setupExchange');
    }),

    bindQueue: mock(async (_queue: string, _exchange: string, _pattern: string): Promise<void> => {
      callLog.push('bindQueue');
    }),

    publish: mock(
      async (_exchange: string, _routingKey: string, _content: unknown, _options?: unknown): Promise<void> => {
        callLog.push('publish');
      },
    ),

    sendToQueue: mock(async (_queue: string, _content: unknown, _options?: unknown): Promise<void> => {
      callLog.push('sendToQueue');
    }),

    consume: mock(
      async (
        queue: string,
        handler: (message: ConsumeMessage | null) => Promise<void>,
        _options?: { noAck?: boolean; prefetch?: number },
      ): Promise<void> => {
        callLog.push('consume');
        consumedHandlers.set(queue, handler);
      },
    ),

    ack: mock(async (_message: ConsumeMessage): Promise<void> => {
      callLog.push('ack');
    }),

    nack: mock(async (_message: ConsumeMessage, _requeue: boolean = true): Promise<void> => {
      callLog.push('nack');
    }),

    /** Handler registered for a queue through consume() (undefined until then). */
    getConsumedHandler: (queue: string) => consumedHandlers.get(queue),
  };

  return client;
}

export type FakeRabbitMQClient = ReturnType<typeof createFakeRabbitMQClient>;
