/**
 * In-memory fake of StakingRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/staking.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 *
 * Amounts are kept as decimal strings: the real repository stores Decimal128
 * and the service only calls .toString() before returning them to callers.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';

export type FakeStakingDoc = {
  _id: Types.ObjectId;
  staker: string;
  amount: string;
  unlockTimestamp: number;
  lastStakeTimestamp: number;
  chainId: string;
  createdAt: number;
  updatedAt: number;
};

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ staker }, { chainId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeStakingRepository() {
  // Keyed by `${staker}|${chainId}`: the real collection has a unique index on { chainId, staker }.
  const store = new Map<string, FakeStakingDoc>();
  const keyOf = (staker: string, chainId: string) => `${staker}|${chainId}`;

  const repository = {
    store,
    keyOf,

    /**
     * Mirrors findOneAndUpdate($set) with upsert: the stored amount is replaced
     * with the absolute value from the event (newVotingPower); lastStakeTimestamp
     * moves only when provided (a stake, or a partial unstake).
     */
    setAmount: mock(async (staker: string, chainId: string, amount: string, lastStakeTimestamp?: number) => {
      const key = keyOf(staker, chainId);
      const existing = store.get(key);
      const timestamp = Math.floor(Date.now() / 1000);

      const doc: FakeStakingDoc = existing
        ? {
            ...existing,
            amount,
            lastStakeTimestamp: lastStakeTimestamp ?? existing.lastStakeTimestamp,
            updatedAt: timestamp,
          }
        : {
            _id: new Types.ObjectId(),
            staker,
            chainId,
            amount,
            unlockTimestamp: 0,
            lastStakeTimestamp: lastStakeTimestamp ?? 0,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

      store.set(key, doc);
      return doc;
    }),

    setUnlockTimestamp: mock(async (staker: string, chainId: string, unlockTimestamp: number) => {
      // Mirrors findOneAndUpdate without upsert: an unknown staker resolves to null.
      const key = keyOf(staker, chainId);
      const existing = store.get(key);
      if (!existing) return null;

      const next: FakeStakingDoc = { ...existing, unlockTimestamp, updatedAt: Math.floor(Date.now() / 1000) };
      store.set(key, next);
      return next;
    }),

    findAll: mock(
      async (
        filter: Record<string, unknown> = {},
        _sort: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' },
        limit = 100,
        offset = 0,
      ) => {
        return Array.from(store.values())
          .filter((doc) => matchesFilter(doc, filter))
          .slice(offset, offset + limit);
      },
    ),
  };

  return repository;
}

export type FakeStakingRepository = ReturnType<typeof createFakeStakingRepository>;
