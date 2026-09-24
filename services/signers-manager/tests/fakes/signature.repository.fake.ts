/**
 * In-memory fake of SignatureRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/signature.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeSignatureDoc = {
  _id: Types.ObjectId;
  taskId: string;
  signer: string;
  signature: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateSignatureInput = Pick<FakeSignatureDoc, 'taskId' | 'signer' | 'signature'>;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ taskId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeSignatureRepository() {
  const store = new Map<string, FakeSignatureDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `Signature ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    create: mock(async (data: CreateSignatureInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeSignatureDoc = { _id: new Types.ObjectId(), createdAt: now, updatedAt: now, ...data };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    findById: mock(async (id: string) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      return doc;
    }),

    findByTaskId: mock(async (taskId: string, _sort: Record<string, 'asc' | 'desc'> = { createdAt: 'asc' }) => {
      // Insertion order is stable in the fake, which matches `sort: { createdAt: 'asc' }`
      // for signatures created within the same second.
      return Array.from(store.values()).filter((doc) => doc.taskId === taskId);
    }),

    countByTaskId: mock(async (taskId: string): Promise<number> => {
      return Array.from(store.values()).filter((doc) => doc.taskId === taskId).length;
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
  };

  return repository;
}

export type FakeSignatureRepository = ReturnType<typeof createFakeSignatureRepository>;
