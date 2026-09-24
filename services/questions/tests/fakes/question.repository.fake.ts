/**
 * In-memory fake of QuestionRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/question.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeQuestionAnswer = {
  text: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
};

export type FakeQuestionDoc = {
  _id: Types.ObjectId;
  topicId: Types.ObjectId;
  text: string;
  answer?: FakeQuestionAnswer;
  answered: boolean;
  likesCount: number;
  ownerId: string;
  ownerType: string;
  creator: string;
  parentId: string;
  grandParentId: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateQuestionInput = {
  topicId: string;
  text: string;
  ownerId: string;
  ownerType: string;
  creator: string;
  parentId: string;
  grandParentId: string;
};

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    // deleteTopic loads the questions of a topic with { topicIds: [id] }, so the fake
    // resolves that array form against the stored topicId field. Other filters use
    // plain equality ({ topicId }, { ownerId }, ...), which is enough for the tests.
    if (key === 'topicIds' && Array.isArray(value)) {
      return value.some((id) => String(doc.topicId) === String(id));
    }

    return String(doc[key]) === String(value);
  });
}

export function createFakeQuestionRepository() {
  const store = new Map<string, FakeQuestionDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `Question ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    create: mock(async (data: CreateQuestionInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeQuestionDoc = {
        _id: new Types.ObjectId(),
        topicId: new Types.ObjectId(data.topicId),
        text: data.text,
        answered: false,
        likesCount: 0,
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

    updateText: mock(async (id: string, text: string) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const next: FakeQuestionDoc = { ...doc, text, updatedAt: Math.floor(Date.now() / 1000) };
      store.set(id, next);
      return next;
    }),

    updateAnswerText: mock(async (id: string, text: string) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const now = Math.floor(Date.now() / 1000);
      // The real update writes the nested answer path, so the fake creates the
      // answer object when the question has none yet and marks it answered.
      const next: FakeQuestionDoc = {
        ...doc,
        answered: true,
        answer: { ...(doc.answer ?? { userId: '', createdAt: now }), text, updatedAt: now },
        updatedAt: now,
      };
      store.set(id, next);
      return next;
    }),

    createAnswer: mock(async (id: string, data: { userId: string; text: string }) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const now = Math.floor(Date.now() / 1000);
      const next: FakeQuestionDoc = {
        ...doc,
        answered: true,
        answer: { userId: data.userId, text: data.text, createdAt: now, updatedAt: now },
        updatedAt: now,
      };
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

    incrementLikes: mock(async (id: string) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const next: FakeQuestionDoc = { ...doc, likesCount: doc.likesCount + 1 };
      store.set(id, next);
      return next;
    }),

    decrementLikes: mock(async (id: string) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const next: FakeQuestionDoc = { ...doc, likesCount: doc.likesCount - 1 };
      store.set(id, next);
      return next;
    }),
  };

  return repository;
}

export type FakeQuestionRepository = ReturnType<typeof createFakeQuestionRepository>;
