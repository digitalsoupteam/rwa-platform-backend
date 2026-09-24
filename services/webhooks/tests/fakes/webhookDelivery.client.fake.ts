/**
 * In-memory fake of WebhookDeliveryClient for unit tests.
 *
 * consumeDelivery captures the handler the daemon registers; enqueues are kept
 * in `sentMessages` and acks/nacks are recorded, so tests can assert delivery
 * decisions and argument mapping. Every method is wrapped in bun:test mock()
 * and, when a shared `journal` array is passed in, each interaction is appended
 * to it so tests can assert ordering (e.g. ack before a retry re-enqueue).
 */
import { mock } from 'bun:test';

export type FakeNackEntry = { message: any; requeue: boolean };

export function createFakeWebhookDeliveryClient(journal: string[] = []) {
  let capturedHandler: ((msg: any) => Promise<void>) | null = null;
  const sentMessages: any[] = [];
  const ackedMessages: any[] = [];
  const nackedMessages: FakeNackEntry[] = [];

  const client = {
    journal,
    sentMessages,
    ackedMessages,
    nackedMessages,

    initialize: mock(async (): Promise<void> => {}),

    sendToDeliveryQueue: mock(async (content: any): Promise<void> => {
      sentMessages.push(content);
      journal.push('sendToDeliveryQueue');
    }),

    consumeDelivery: mock(async (handler: (msg: any) => Promise<void>): Promise<void> => {
      capturedHandler = handler;
      journal.push('consumeDelivery');
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

export type FakeWebhookDeliveryClient = ReturnType<typeof createFakeWebhookDeliveryClient>;
