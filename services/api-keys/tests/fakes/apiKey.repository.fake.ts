/**
 * In-memory fake of ApiKeyRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/apiKey.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeApiKeyDoc = {
  _id: Types.ObjectId;
  userId: string;
  wallet: string;
  name: string;
  keyHash: string;
  prefix: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateApiKeyInput = Pick<FakeApiKeyDoc, 'userId' | 'wallet' | 'name' | 'keyHash' | 'prefix'>;

export function createFakeApiKeyRepository() {
  const store = new Map<string, FakeApiKeyDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `ApiKey ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  // Mirrors `.select('-keyHash')`: read paths that use it never hand out the hash.
  const withoutKeyHash = (doc: FakeApiKeyDoc) => {
    const { _id, userId, wallet, name, prefix, createdAt, updatedAt } = doc;
    return { _id, userId, wallet, name, prefix, createdAt, updatedAt };
  };

  const repository = {
    store,

    create: mock(async (data: CreateApiKeyInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeApiKeyDoc = { _id: new Types.ObjectId(), createdAt: now, updatedAt: now, ...data };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    // The real query is { _id, userId } — a foreign key is indistinguishable from a missing one.
    findById: mock(async (params: { id: string; userId: string }) => {
      const doc = store.get(params.id);
      if (!doc || doc.userId !== params.userId) throw notFound(params.id);

      return doc;
    }),

    findByIdUnscoped: mock(async (id: string) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      return doc;
    }),

    findAll: mock(async (filters: { userId: string }) => {
      return Array.from(store.values())
        .filter((doc) => doc.userId === filters.userId)
        .map(withoutKeyHash);
    }),

    delete: mock(async (params: { id: string; userId: string }) => {
      const doc = store.get(params.id);
      if (!doc || doc.userId !== params.userId) throw notFound(params.id);

      store.delete(params.id);
      return doc;
    }),

    update: mock(async (params: { id: string; userId: string; name: string }) => {
      const doc = store.get(params.id);
      if (!doc || doc.userId !== params.userId) throw notFound(params.id);

      const next: FakeApiKeyDoc = { ...doc, name: params.name, updatedAt: Math.floor(Date.now() / 1000) };
      store.set(params.id, next);

      return withoutKeyHash(next);
    }),

    findByKeyHash: mock(async (keyHash: string) => {
      const doc = Array.from(store.values()).find((candidate) => candidate.keyHash === keyHash);
      if (!doc) throw new AppError({ message: 'ApiKey not found', statusCode: 404, code: 'NOT_FOUND' });

      return doc;
    }),
  };

  return repository;
}

export type FakeApiKeyRepository = ReturnType<typeof createFakeApiKeyRepository>;
