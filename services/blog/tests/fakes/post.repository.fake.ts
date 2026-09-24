/**
 * In-memory fake of PostRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/post.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakePostDoc = {
  _id: Types.ObjectId;
  blogId: Types.ObjectId;
  title: string;
  content: string;
  images: string[];
  documents: string[];
  ownerId: string;
  ownerType: string;
  creator: string;
  parentId: string;
  grandParentId: string;
  createdAt: number;
  updatedAt: number;
};

export type CreatePostInput = Omit<
  FakePostDoc,
  '_id' | 'blogId' | 'createdAt' | 'updatedAt' | 'images' | 'documents'
> & {
  blogId: string;
  images?: string[];
  documents?: string[];
};

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    // BlogsService.deleteBlog queries a blog's posts with { blogIds: [id] } (plural list
    // filter), while every post document stores a single blogId (see src/models/entity/post.entity.ts).
    // The fake maps that list filter onto the post's blogId so the cascade delete is testable here.
    if (key === 'blogIds' && Array.isArray(value)) {
      return value.some((entry) => String(doc.blogId) === String(entry));
    }

    // Equality matching is enough for the other filters used by tests ({ blogId }, ...).
    return String(doc[key]) === String(value);
  });
}

export function createFakePostRepository() {
  const store = new Map<string, FakePostDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `Post ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    create: mock(async (data: CreatePostInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakePostDoc = {
        _id: new Types.ObjectId(),
        blogId: new Types.ObjectId(data.blogId),
        title: data.title,
        content: data.content,
        images: data.images ?? [],
        documents: data.documents ?? [],
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

    update: mock(
      async (id: string, data: Partial<{ title: string; content: string; images: string[]; documents: string[] }>) => {
        const doc = store.get(id);
        if (!doc) throw notFound(id);

        const next: FakePostDoc = { ...doc, ...data, updatedAt: Math.floor(Date.now() / 1000) };
        store.set(id, next);
        return next;
      },
    ),

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

export type FakePostRepository = ReturnType<typeof createFakePostRepository>;
