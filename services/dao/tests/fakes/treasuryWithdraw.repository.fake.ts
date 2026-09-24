/**
 * In-memory fake of TreasuryWithdrawRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/treasuryWithdraw.repository.ts, and
 * every method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';

export type FakeTreasuryWithdrawDoc = {
  _id: Types.ObjectId;
  recipient: string;
  token: string;
  // The real schema stores Decimal128; the fake keeps the decimal string
  // (the service only calls .toString() on it).
  amount: string;
  chainId: string;
  transactionHash: string;
  logIndex: number;
  createdAt: number;
  updatedAt: number;
};

export type CreateTreasuryWithdrawInput = Omit<FakeTreasuryWithdrawDoc, '_id' | 'createdAt' | 'updatedAt'>;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ recipient }, { token }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeTreasuryWithdrawRepository() {
  const store = new Map<string, FakeTreasuryWithdrawDoc>();

  const repository = {
    store,

    create: mock(async (data: CreateTreasuryWithdrawInput) => {
      const timestamp = Math.floor(Date.now() / 1000);
      const doc: FakeTreasuryWithdrawDoc = {
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

export type FakeTreasuryWithdrawRepository = ReturnType<typeof createFakeTreasuryWithdrawRepository>;
