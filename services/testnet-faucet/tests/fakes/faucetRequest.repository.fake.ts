/**
 * In-memory fake of FaucetRequestRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/faucetRequest.repository.ts, and
 * every method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import type { FaucetTokenType } from '../../src/models/shared/enums.model';

export type FakeFaucetRequestDoc = {
  _id: Types.ObjectId;
  userId: string;
  wallet: string;
  tokenType: FaucetTokenType;
  amount: number;
  transactionHash: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateFaucetRequestInput = {
  userId: string;
  wallet: string;
  tokenType: FaucetTokenType;
  amount: number;
  transactionHash: string;
};

type FindAllFilter = {
  userId?: string;
  wallet?: string;
  tokenType?: FaucetTokenType;
};

type FindAllOptions = {
  limit?: number;
  offset?: number;
  sort?: Record<string, 'asc' | 'desc'>;
};

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ userId }, { userId, tokenType }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

function sortDocs(sort: Record<string, 'asc' | 'desc'>) {
  return (a: FakeFaucetRequestDoc, b: FakeFaucetRequestDoc): number => {
    for (const [key, direction] of Object.entries(sort)) {
      const left = (a as Record<string, any>)[key];
      const right = (b as Record<string, any>)[key];
      if (left === right) continue;

      return (left > right ? 1 : -1) * (direction === 'desc' ? -1 : 1);
    }

    return 0;
  };
}

export function createFakeFaucetRequestRepository() {
  const store = new Map<string, FakeFaucetRequestDoc>();

  const repository = {
    store,

    create: mock(async (data: CreateFaucetRequestInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeFaucetRequestDoc = { _id: new Types.ObjectId(), createdAt: now, updatedAt: now, ...data };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    findById: mock(async (id: string) => {
      // The real repository returns undefined (not an error) when the id is unknown.
      return store.get(id);
    }),

    findAll: mock(async (filter: FindAllFilter = {}, options: FindAllOptions = {}) => {
      const { limit = 50, offset = 0, sort = { createdAt: 'asc' } } = options;

      return Array.from(store.values())
        .filter((doc) => matchesFilter(doc, filter))
        .sort(sortDocs(sort))
        .slice(offset, offset + limit);
    }),
  };

  return repository;
}

export type FakeFaucetRequestRepository = ReturnType<typeof createFakeFaucetRequestRepository>;
