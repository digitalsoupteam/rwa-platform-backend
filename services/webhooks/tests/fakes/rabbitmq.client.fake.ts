/**
 * In-memory fake of RabbitMQClient (@shared/rabbitmq) for unit tests.
 *
 * Records every topology setup, publish, send and ack/nack, and captures the
 * consume handlers per queue so tests can invoke them with synthetic messages.
 * Nothing is ever connected: no broker, no sockets. The public API mirrors
 * shared/rabbitmq/src/rabbitmq.client.ts and every method is wrapped in
 * bun:test mock() so interactions can be asserted. An optional `journal`
 * collects interaction names in call order, so tests can assert sequences
 * across several fakes sharing the same array.
 */
import { mock } from 'bun:test';

export type FakeRabbitSetup = { kind: 'queue' | 'exchange' | 'binding'; args: any[] };

export function createFakeRabbitMQClient(journal: string[] = []) {
  const handlers = new Map<string, (msg: any) => Promise<void>>();
  const setups: FakeRabbitSetup[] = [];
  const published: Array<{ exchange: string; routingKey: string; content: any; options?: any }> = [];
  const sent: Array<{ queue: string; content: any; options?: any }> = [];
  const acked: any[] = [];
  const nacked: Array<{ message: any; requeue: boolean }> = [];

  const client = {
    // Test-only handles for seeding and inspecting broker state.
    handlers,
    setups,
    published,
    sent,
    acked,
    nacked,

    connect: mock(async (): Promise<void> => {}),

    disconnect: mock(async (): Promise<void> => {}),

    setupQueue: mock(async (queue: string, options?: any): Promise<void> => {
      setups.push({ kind: 'queue', args: [queue, options] });
    }),

    setupExchange: mock(async (exchange: string, type: string, options?: any): Promise<void> => {
      setups.push({ kind: 'exchange', args: [exchange, type, options] });
    }),

    bindQueue: mock(async (queue: string, exchange: string, pattern: string): Promise<void> => {
      setups.push({ kind: 'binding', args: [queue, exchange, pattern] });
    }),

    publish: mock(async (exchange: string, routingKey: string, content: any, options?: any): Promise<void> => {
      published.push({ exchange, routingKey, content, options });
      journal.push('publish');
    }),

    sendToQueue: mock(async (queue: string, content: any, options?: any): Promise<void> => {
      sent.push({ queue, content, options });
      journal.push('sendToQueue');
    }),

    consume: mock(async (queue: string, handler: (msg: any) => Promise<void>, options?: any): Promise<void> => {
      handlers.set(queue, handler);
      journal.push('consume');
    }),

    ack: mock(async (message: any): Promise<void> => {
      acked.push(message);
      journal.push('ack');
    }),

    nack: mock(async (message: any, requeue: boolean = true): Promise<void> => {
      nacked.push({ message, requeue });
      journal.push('nack');
    }),
  };

  return client;
}

export type FakeRabbitMQClient = ReturnType<typeof createFakeRabbitMQClient>;
