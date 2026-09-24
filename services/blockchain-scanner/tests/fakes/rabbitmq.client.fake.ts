/**
 * In-memory fake of RabbitMQClient for unit tests.
 *
 * The real client publishes in confirm mode through amqp-connection-manager.
 * Tests use this fake to keep the scanner isolated: no broker, no network,
 * deterministic publish order. The public API mirrors the surface the scanner
 * uses from shared/rabbitmq/src/rabbitmq.client.ts, and every method is
 * wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';

export type FakePublishedMessage = {
  exchange: string;
  routingKey: string;
  content: any;
  options?: any;
};

export function createFakeRabbitMQClient() {
  const published: FakePublishedMessage[] = [];
  const state = {
    // When set, publish() rejects for this routing key; mirrors a broker
    // failure on one event name. Every other publish still succeeds.
    failPublishFor: null as string | null,
  };

  const client = {
    published,
    state,

    publish: mock(async (exchange: string, routingKey: string, content: any, options?: any): Promise<void> => {
      if (state.failPublishFor === routingKey) {
        throw new Error(`publish failed for routing key ${routingKey}`);
      }

      published.push({ exchange, routingKey, content, options });
    }),

    disconnect: mock(async (): Promise<void> => {}),
  };

  return client;
}

export type FakeRabbitMQClient = ReturnType<typeof createFakeRabbitMQClient>;
