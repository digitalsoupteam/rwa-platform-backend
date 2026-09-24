/**
 * In-memory fake of AnswerRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/answer.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeAnswerDoc = {
  _id: Types.ObjectId;
  topicId: Types.ObjectId;
  question: string;
  answer: string;
  order: number;
  ownerId: string;
  ownerType: string;
  creator: string;
  parentId: string;
  grandParentId: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateAnswerInput = Omit<FakeAnswerDoc, '_id' | 'createdAt' | 'updatedAt' | 'topicId' | 'order'> & {
  topicId: string;
  order?: number;
};

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ topicId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeAnswerRepository() {
  const store = new Map<string, FakeAnswerDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `Answer ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    create: mock(async (data: CreateAnswerInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeAnswerDoc = {
        _id: new Types.ObjectId(),
        topicId: new Types.ObjectId(data.topicId),
        question: data.question,
        answer: data.answer,
        order: data.order ?? 0,
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

    update: mock(async (id: string, data: Partial<{ question: string; answer: string; order: number }>) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const next: FakeAnswerDoc = { ...doc, ...data, updatedAt: Math.floor(Date.now() / 1000) };
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
        _sort: Record<string, 'asc' | 'desc'> = { order: 'desc', createdAt: 'asc' },
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

export type FakeAnswerRepository = ReturnType<typeof createFakeAnswerRepository>;
