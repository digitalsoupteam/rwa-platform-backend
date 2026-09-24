/**
 * In-memory fakes of the eden treaty clients injected into ai-assistant
 * (src/clients/eden.clients.ts): the RWA client and the portfolio client.
 *
 * Both fakes keep the eden { data, error } envelope shape of treaty responses,
 * so ContextService paths for success (data), upstream failure (error envelope)
 * and transport failure (throw) can be exercised without any network access.
 * Every call is wrapped in bun:test mock() so request payloads can be asserted.
 */
import { mock } from 'bun:test';

/** Minimised pool shape returned by the RWA service (fields used by ContextService). */
export type FakePool = {
  id: string;
  name: string;
  poolAddress: string;
  awaitingRwaAmount: string;
  expectedRwaAmount: string;
};

/** Minimised token balance shape returned by the portfolio service. */
export type FakeTokenBalance = {
  owner: string;
  poolAddress: string;
  balance: number;
};

/** Eden failure envelope: treaty resolves (it does not reject) on HTTP errors. */
export type FakeEdenError = { status: number; value: unknown };

export type FakeGetPoolsBody = {
  filter?: Record<string, unknown>;
  sort?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
};

export type FakeGetBalancesBody = {
  filter?: Record<string, unknown>;
  sort?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
};

export function createFakeRwaClient() {
  const state = {
    pools: [] as FakePool[],
    /** When set, getPools resolves with an eden error envelope instead of data. */
    errorResponse: null as FakeEdenError | null,
    /** When set, getPools rejects with this error (transport-level failure). */
    throwError: null as Error | null,
  };

  const client = {
    state,

    // The fake returns every seeded pool and does not re-implement Mongo-style
    // filter semantics; tests assert the payload forwarded to the client instead.
    getPools: {
      post: mock(async (_body: FakeGetPoolsBody) => {
        if (state.throwError) throw state.throwError;
        if (state.errorResponse) return { data: null, error: state.errorResponse };

        return { data: state.pools, error: null };
      }),
    },
  };

  return client;
}

export type FakeRwaClient = ReturnType<typeof createFakeRwaClient>;

export function createFakePortfolioClient() {
  const state = {
    balances: [] as FakeTokenBalance[],
    /** When set, getBalances resolves with an eden error envelope instead of data. */
    errorResponse: null as FakeEdenError | null,
    /** When set, getBalances rejects with this error (transport-level failure). */
    throwError: null as Error | null,
  };

  const client = {
    state,

    getBalances: {
      post: mock(async (_body: FakeGetBalancesBody) => {
        if (state.throwError) throw state.throwError;
        if (state.errorResponse) return { data: null, error: state.errorResponse };

        return { data: state.balances, error: null };
      }),
    },
  };

  return client;
}

export type FakePortfolioClient = ReturnType<typeof createFakePortfolioClient>;
