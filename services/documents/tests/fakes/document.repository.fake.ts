/**
 * In-memory fake of DocumentRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/document.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeDocumentDoc = {
  _id: Types.ObjectId;
  folderId: Types.ObjectId;
  name: string;
  fileId: string;
  path: string;
  mimeType: string;
  size: number;
  ownerId: string;
  ownerType: string;
  creator: string;
  parentId: string;
  grandParentId: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateDocumentInput = Omit<FakeDocumentDoc, '_id' | 'folderId' | 'createdAt' | 'updatedAt'> & {
  folderId: Types.ObjectId | string;
};

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ folderId }, { ownerId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeDocumentRepository() {
  const store = new Map<string, FakeDocumentDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `Document ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    create: mock(async (data: CreateDocumentInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeDocumentDoc = {
        _id: new Types.ObjectId(),
        folderId: new Types.ObjectId(data.folderId), // mongoose casts the ref to an ObjectId on create
        name: data.name,
        fileId: data.fileId,
        path: data.path,
        mimeType: data.mimeType,
        size: data.size,
        ownerId: data.ownerId,
        ownerType: data.ownerType,
        creator: data.creator,
        parentId: data.parentId,
        grandParentId: data.grandParentId,
        createdAt: now,
        updatedAt: now,
      };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    update: mock(async (id: string, data: Partial<{ name: string }>) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const next: FakeDocumentDoc = { ...doc, ...data, updatedAt: Math.floor(Date.now() / 1000) };
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

export type FakeDocumentRepository = ReturnType<typeof createFakeDocumentRepository>;
