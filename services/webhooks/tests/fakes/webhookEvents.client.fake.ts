/**
 * In-memory fake of WebhookEventsClient for unit tests.
 *
 * consumeEvents captures the handler the daemon registers; ackMessage and
 * nackMessage are recorded so tests can assert the daemon's ack/nack
 * decisions. Every method is wrapped in bun:test mock() and, when a shared
 * `journal` array is passed in, each interaction is appended to it so tests can
 * assert ordering across the two client fakes (e.g. enqueue before ack).
 */
import { mock } from 'bun:test';

export type FakeNackEntry = { message: any; requeue: boolean };

export function createFakeWebhookEventsClient(journal: string[] = []) {
  let capturedHandler: ((msg: any) => Promise<void>) | null = null;
  const ackedMessages: any[] = [];
  const nackedMessages: FakeNackEntry[] = [];

  const client = {
    journal,
    ackedMessages,
    nackedMessages,

    initialize: mock(async (): Promise<void> => {}),

    consumeEvents: mock(async (handler: (msg: any) => Promise<void>): Promise<void> => {
      capturedHandler = handler;
      journal.push('consumeEvents');
    }),

    ackMessage: mock(async (msg: any): Promise<void> => {
      ackedMessages.push(msg);
      journal.push('ackMessage');
    }),

    nackMessage: mock(async (msg: any, requeue: boolean = true): Promise<void> => {
      nackedMessages.push({ message: msg, requeue });
      journal.push('nackMessage');
    }),

    getHandler: () => capturedHandler,
  };

  return client;
}

export type FakeWebhookEventsClient = ReturnType<typeof createFakeWebhookEventsClient>;
