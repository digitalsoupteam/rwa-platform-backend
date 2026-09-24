/**
 * In-memory fake of WebhookEventsPublisher (shared/webhooks).
 *
 * The real publisher sends webhook events to the `webhooks.events` rabbit
 * exchange; this fake only records publish() calls.
 */
import { mock } from 'bun:test';

export function createFakeWebhookEventsPublisher() {
  return {
    initialize: mock(async (): Promise<void> => {}),

    publish: mock(async (_eventType: string, _payload: unknown): Promise<void> => {}),
  };
}

export type FakeWebhookEventsPublisher = ReturnType<typeof createFakeWebhookEventsPublisher>;
