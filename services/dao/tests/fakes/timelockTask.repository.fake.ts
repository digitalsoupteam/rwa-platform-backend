/**
 * In-memory fake of TimelockTaskRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/timelockTask.repository.ts, and
 * every method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';

export type FakeTimelockTaskDoc = {
  _id: Types.ObjectId;
  txHash: string;
  target: string;
  data: string;
  eta: number;
  executed: boolean;
  chainId: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateTimelockTaskInput = Omit<FakeTimelockTaskDoc, '_id' | 'createdAt' | 'updatedAt' | 'executed'>;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ txHash }, { chainId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeTimelockTaskRepository() {
  // txHash is unique in the real collection, so it is the natural store key.
  const store = new Map<string, FakeTimelockTaskDoc>();

  const now = () => Math.floor(Date.now() / 1000);

  const repository = {
    store,

    create: mock(async (data: CreateTimelockTaskInput) => {
      const timestamp = now();
      const doc: FakeTimelockTaskDoc = {
        _id: new Types.ObjectId(),
        executed: false, // schema default, same as TimelockTaskEntity
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      store.set(doc.txHash, doc);
      return doc;
    }),

    updateExecuted: mock(async (txHash: string, executed: boolean = true) => {
      // Mirrors findOneAndUpdate without upsert: an unknown txHash resolves to null.
      const doc = store.get(txHash);
      if (!doc) return null;

      const next: FakeTimelockTaskDoc = { ...doc, executed, updatedAt: now() };
      store.set(txHash, next);
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

export type FakeTimelockTaskRepository = ReturnType<typeof createFakeTimelockTaskRepository>;
