/**
 * In-memory fake of RedisEventsClient for unit tests.
 *
 * The real client owns two ioredis connections and publishes JSON event
 * envelopes to Redis channels. Tests use this fake to keep the service layer
 * isolated: nothing connects, nothing is published over the network, and every
 * call is recorded. The public API mirrors
 * shared/redis-events/src/redis-events.client.ts, and every method is wrapped
 * in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';

export type FakePublishedEvent = {
  channel: string;
  type: string;
  payload: unknown;
};

export function createFakeRedisEventsClient() {
  // Every publish() in call order - the same (channel, type, payload) triple
  // the callers hand to the real client.
  const published: FakePublishedEvent[] = [];

  const client = {
    published,

    publish: mock(async (channel: string, type: string, payload: unknown): Promise<void> => {
      published.push({ channel, type, payload });
    }),

    subscribe: mock((_channel: string, _callback: (event: unknown) => void) => {
      // The real client returns an unsubscribe function.
      return () => {};
    }),

    close: mock(async (): Promise<void> => {}),
  };

  return client;
}

export type FakeRedisEventsClient = ReturnType<typeof createFakeRedisEventsClient>;
