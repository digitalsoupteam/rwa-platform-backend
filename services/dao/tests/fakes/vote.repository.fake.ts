/**
 * In-memory fake of VoteRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/vote.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';

export type FakeVoteDoc = {
  _id: Types.ObjectId;
  proposalId: string;
  chainId: string;
  governanceAddress: string;
  voterWallet: string;
  support: boolean;
  // The real schema stores Decimal128; the fake keeps the decimal string the
  // repository received, because the service only calls .toString() on it.
  weight: string;
  reason: string;
  transactionHash: string;
  logIndex: number;
  blockNumber: number;
  createdAt: number;
  updatedAt: number;
};

export type CreateVoteInput = Omit<FakeVoteDoc, '_id' | 'createdAt' | 'updatedAt'>;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ proposalId }, { voterWallet }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeVoteRepository() {
  const store = new Map<string, FakeVoteDoc>();

  const repository = {
    store,

    create: mock(async (data: CreateVoteInput) => {
      const timestamp = Math.floor(Date.now() / 1000);
      const doc: FakeVoteDoc = {
        _id: new Types.ObjectId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      store.set(doc._id.toString(), doc);
      return doc;
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

export type FakeVoteRepository = ReturnType<typeof createFakeVoteRepository>;
