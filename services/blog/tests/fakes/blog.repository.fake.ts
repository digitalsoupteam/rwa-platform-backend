/**
 * In-memory fake of BlogRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/blog.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeBlogDoc = {
  _id: Types.ObjectId;
  name: string;
  ownerId: string;
  ownerType: string;
  creator: string;
  parentId: string;
  grandParentId: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateBlogInput = Omit<FakeBlogDoc, '_id' | 'createdAt' | 'updatedAt'>;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ ownerId }, { creator }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeBlogRepository() {
  const store = new Map<string, FakeBlogDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `Blog ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    create: mock(async (data: CreateBlogInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeBlogDoc = { _id: new Types.ObjectId(), createdAt: now, updatedAt: now, ...data };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    update: mock(async (id: string, data: Partial<{ name: string }>) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const next: FakeBlogDoc = { ...doc, ...data, updatedAt: Math.floor(Date.now() / 1000) };
      store.set(id, next);
      return next;
    }),

    delete: mock(async (id: string) => {
      if (!store.has(id)) throw notFound(id);

      store.delete(id);
      return id;
    }),

    findById: mock(async (id: string) => {
      const doc = store.get(id);
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
  };

  return repository;
}

export type FakeBlogRepository = ReturnType<typeof createFakeBlogRepository>;
