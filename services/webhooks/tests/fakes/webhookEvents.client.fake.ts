/**
 * In-memory fake of WebhookEventsClient for app assembly in tests.
 *
 * The client only declares the queue topology now; the consumer side lives in
 * ReliableConsumer (wired by the daemon to the fake RabbitMQ client directly),
 * so the fake just satisfies the plugin decorators.
 */
import { mock } from 'bun:test';

export function createFakeWebhookEventsClient() {
  return {
    initialize: mock(async (): Promise<void> => {}),
  };
}

export type FakeWebhookEventsClient = ReturnType<typeof createFakeWebhookEventsClient>;
