/**
 * In-memory fake of RedisEventsClient (shared/redis-events).
 *
 * The real client publishes JSON events to a redis channel; this fake keeps
 * the same public API and only records calls with bun:test mocks.
 */
import { mock } from 'bun:test';

export function createFakeRedisEventsClient() {
  return {
    publish: mock(async (_channel: string, _type: string, _payload: unknown): Promise<void> => {}),

    subscribe: mock((_channel: string, _callback: (event: unknown) => void) => () => {}),

    close: mock(async (): Promise<void> => {}),
  };
}

export type FakeRedisEventsClient = ReturnType<typeof createFakeRedisEventsClient>;
