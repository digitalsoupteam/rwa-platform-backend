/**
 * In-memory fake of PoolEventsClient (src/clients/poolEvents.client.ts).
 *
 * Like the real client, publishPoolDeployed delegates to the redis client
 * (`publish('pool:deployed', 'POOL_DEPLOYED', pool)`), so tests can assert at
 * either level. Methods are wrapped in bun:test mock().
 */
import { mock } from 'bun:test';
import { createFakeRedisEventsClient, type FakeRedisEventsClient } from './redis-events.client.fake';

export function createFakePoolEventsClient(redisClient: FakeRedisEventsClient = createFakeRedisEventsClient()) {
  return {
    redisClient,

    publishPoolDeployed: mock(async (pool: unknown): Promise<void> => {
      await redisClient.publish('pool:deployed', 'POOL_DEPLOYED', pool);
    }),
  };
}

export type FakePoolEventsClient = ReturnType<typeof createFakePoolEventsClient>;
