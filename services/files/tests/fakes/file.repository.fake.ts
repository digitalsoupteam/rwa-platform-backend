/**
 * In-memory fake of FileRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/file.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeFileDoc = {
  _id: Types.ObjectId;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateFileInput = Pick<FakeFileDoc, 'name' | 'path' | 'size' | 'mimeType'>;

export function createFakeFileRepository() {
  const store = new Map<string, FakeFileDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `File ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    create: mock(async (data: CreateFileInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeFileDoc = { _id: new Types.ObjectId(), createdAt: now, updatedAt: now, ...data };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    findById: mock(async (id: string) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      return doc;
    }),

    findByPath: mock(async (path: string) => {
      const doc = Array.from(store.values()).find((candidate) => candidate.path === path);
      if (!doc) throw notFound(path);

      return doc;
    }),

    update: mock(async (id: string, data: Partial<Pick<FakeFileDoc, 'name'>>) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const next: FakeFileDoc = { ...doc, updatedAt: Math.floor(Date.now() / 1000) };
      // Mirrors mongoose $set on the name field: an undefined value is dropped, not persisted.
      if (data.name !== undefined) next.name = data.name;

      store.set(id, next);
      return next;
    }),

    delete: mock(async (id: string) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      store.delete(id);
      return doc;
    }),
  };

  return repository;
}

export type FakeFileRepository = ReturnType<typeof createFakeFileRepository>;
