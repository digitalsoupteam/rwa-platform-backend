/**
 * In-memory fake of ChartEventsClient for unit tests.
 *
 * The real client publishes price and transaction updates through a
 * RedisEventsClient. Tests use this fake to keep the service and HTTP layers
 * isolated: nothing connects to Redis and every published update is recorded.
 * The public API mirrors src/clients/redis.client.ts, and every method is
 * wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';

export type FakePriceUpdate = {
  poolAddress: string;
  timestamp: number;
  price: string;
  realHoldReserve: string;
  virtualHoldReserve: string;
  virtualRwaReserve: string;
};

export type FakeTransactionUpdate = {
  poolAddress: string;
  timestamp: number;
  transactionType: string;
  userAddress: string;
  rwaAmount: string;
  holdAmount: string;
  bonusAmount: string;
  holdFee: string;
  bonusFee: string;
};

export function createFakeChartEventsClient() {
  const priceUpdates: FakePriceUpdate[] = [];
  const transactionUpdates: FakeTransactionUpdate[] = [];

  const client = {
    priceUpdates,
    transactionUpdates,

    publishPriceUpdate: mock(async (data: FakePriceUpdate): Promise<void> => {
      priceUpdates.push(data);
    }),

    publishTransactionUpdate: mock(async (data: FakeTransactionUpdate): Promise<void> => {
      transactionUpdates.push(data);
    }),
  };

  return client;
}

export type FakeChartEventsClient = ReturnType<typeof createFakeChartEventsClient>;
