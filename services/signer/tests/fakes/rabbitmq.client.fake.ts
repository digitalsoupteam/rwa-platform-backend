/**
 * In-memory fake of RabbitMQClient (@shared/rabbitmq) for unit tests.
 *
 * Mirrors the public API of shared/rabbitmq/src/rabbitmq.client.ts without
 * touching amqp-connection-manager: every method is a bun:test mock, consumed
 * handlers are captured per queue, and sent/acked/nacked messages are recorded
 * so daemon tests can assert the reliability decisions. No broker, no sockets.
 */
import { mock } from 'bun:test';

export function createFakeRabbitMQClient() {
  const handlers = new Map<string, (msg: any) => Promise<void>>();
  const sent: Array<{ queue: string; content: any; options?: any }> = [];
  const acked: any[] = [];
  const nacked: Array<{ message: any; requeue: boolean }> = [];

  const client = {
    handlers,
    sent,
    acked,
    nacked,

    connect: mock(async (): Promise<void> => {}),

    disconnect: mock(async (): Promise<void> => {}),

    setupQueue: mock(async (_queue: string, _options?: any): Promise<void> => {}),

    setupExchange: mock(async (_exchange: string, _type: string, _options?: any): Promise<void> => {}),

    bindQueue: mock(async (_queue: string, _exchange: string, _pattern: string): Promise<void> => {}),

    publish: mock(async (_exchange: string, _routingKey: string, _content: any, _options?: any): Promise<void> => {}),

    sendToQueue: mock(async (queue: string, content: any, options?: any): Promise<void> => {
      sent.push({ queue, content, options });
    }),

    consume: mock(async (queue: string, handler: (msg: any) => Promise<void>, _options?: any): Promise<void> => {
      handlers.set(queue, handler);
    }),

    ack: mock(async (message: any): Promise<void> => {
      acked.push(message);
    }),

    nack: mock(async (message: any, requeue: boolean = true): Promise<void> => {
      nacked.push({ message, requeue });
    }),
  };

  return client;
}

export type FakeRabbitMQClient = ReturnType<typeof createFakeRabbitMQClient>;
