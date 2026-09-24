/**
 * In-memory fake of TokenBalanceRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/tokenBalance.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 *
 * Faithfulness notes:
 * - updateBalance mimics findOneAndUpdate({ new: true, upsert: true }): the
 *   balance is incremented by `amount`, lastUpdateBlock is always set and the
 *   position is created on first sight.
 * - The real entity declares a UNIQUE index on { owner, poolAddress, chainId }
 *   (tokenBalance.entity.ts:57), while the update filter additionally keys on
 *   tokenAddress and tokenId. The fake keys its store on the full filter tuple,
 *   so it does not reproduce duplicate-key failures of the real index.
 * - Mongo-only fields (`__v`) are not modelled; callers only consume the fields
 *   the service maps.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type TokenBalancePosition = {
  owner: string;
  tokenAddress: string;
  tokenId: string;
  poolAddress: string;
  chainId: string;
};

export type FakeTokenBalanceDoc = TokenBalancePosition & {
  _id: Types.ObjectId;
  balance: number;
  lastUpdateBlock: number;
  createdAt: number;
  updatedAt: number;
};

export function positionKey(parts: TokenBalancePosition): string {
  return [parts.owner, parts.tokenAddress, parts.tokenId, parts.poolAddress, parts.chainId].join('|');
}

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ owner }, { poolAddress }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeTokenBalanceRepository() {
  // Keyed by the position tuple (owner|token|tokenId|pool|chain), like the
  // real findOneAndUpdate filter; findById scans the values by _id.
  const store = new Map<string, FakeTokenBalanceDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `TokenBalance ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,
    keyOf: positionKey,

    findById: mock(async (id: string) => {
      const doc = Array.from(store.values()).find((item) => item._id.toString() === id);
      if (!doc) throw notFound(id);

      return doc;
    }),

    findAll: mock(
      async (
        filter: Record<string, unknown> = {},
        _sort: Record<string, 'asc' | 'desc'> = { createdAt: 'asc' },
        limit = 100,
        offset = 0,
      ) => {
        return Array.from(store.values())
          .filter((doc) => matchesFilter(doc, filter))
          .slice(offset, offset + limit);
      },
    ),

    updateBalance: mock(
      async (
        owner: string,
        tokenAddress: string,
        tokenId: string,
        poolAddress: string,
        chainId: string,
        amount: number,
        lastUpdateBlock: number,
      ) => {
        const now = Math.floor(Date.now() / 1000);
        const key = positionKey({ owner, tokenAddress, tokenId, poolAddress, chainId });
        const existing = store.get(key);

        const doc: FakeTokenBalanceDoc = existing
          ? { ...existing, balance: existing.balance + amount, lastUpdateBlock, updatedAt: now }
          : {
              _id: new Types.ObjectId(),
              owner,
              tokenAddress,
              tokenId,
              poolAddress,
              chainId,
              balance: amount,
              lastUpdateBlock,
              createdAt: now,
              updatedAt: now,
            };

        store.set(key, doc);
        return { ...doc };
      },
    ),
  };

  return repository;
}

export type FakeTokenBalanceRepository = ReturnType<typeof createFakeTokenBalanceRepository>;
