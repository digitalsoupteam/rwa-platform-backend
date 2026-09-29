/**
 * In-memory fake of WebhookDeliveryClient for unit tests.
 *
 * Only the delivery enqueue path remains on the client (retries and acks are
 * executed by ReliableConsumer against the fake RabbitMQ client); enqueues are
 * kept in `sentMessages` and, when a shared `journal` array is passed in, each
 * enqueue is appended to it so tests can assert ordering against the broker
 * fake's entries.
 */
import { mock } from 'bun:test';

export function createFakeWebhookDeliveryClient(journal: string[] = []) {
  const sentMessages: any[] = [];

  return {
    journal,
    sentMessages,

    initialize: mock(async (): Promise<void> => {}),

    sendToDeliveryQueue: mock(async (content: any): Promise<void> => {
      sentMessages.push(content);
      journal.push('sendToDeliveryQueue');
    }),
  };
}

export type FakeWebhookDeliveryClient = ReturnType<typeof createFakeWebhookDeliveryClient>;
