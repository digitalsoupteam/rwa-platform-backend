/**
 * In-memory fake of QuestionLikesRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/questionLikes.repository.ts, and
 * every method is wrapped in bun:test mock() so interactions can be asserted.
 *
 * Likes are keyed by the (questionId, userId) pair, mirroring the unique
 * index of the real collection.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeQuestionLikesDoc = {
  _id: Types.ObjectId;
  questionId: Types.ObjectId;
  userId: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateQuestionLikesInput = {
  questionId: string;
  userId: string;
};

export function createFakeQuestionLikesRepository() {
  const store = new Map<string, FakeQuestionLikesDoc>();

  const key = (questionId: string, userId: string) => `${questionId}:${userId}`;

  const notFound = (questionId: string, userId: string) =>
    new AppError({
      message: `QuestionLike ${questionId}:${userId} not found`,
      statusCode: 404,
      code: 'NOT_FOUND',
    });

  const repository = {
    store,

    create: mock(async (data: CreateQuestionLikesInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeQuestionLikesDoc = {
        _id: new Types.ObjectId(),
        questionId: new Types.ObjectId(data.questionId),
        userId: data.userId,
        createdAt: now,
        updatedAt: now,
      };
      store.set(key(data.questionId, data.userId), doc);
      return doc;
    }),

    delete: mock(async (questionId: string, userId: string) => {
      const doc = store.get(key(questionId, userId));
      if (!doc) throw notFound(questionId, userId);

      store.delete(key(questionId, userId));
      return doc;
    }),

    exists: mock(async (questionId: string, userId: string) => store.has(key(questionId, userId))),

    findByQuestionId: mock(
      async (
        questionId: string,
        _sort: Record<string, 'asc' | 'desc'> = { createdAt: 'asc' },
        limit = 100,
        offset = 0,
      ) => {
        return Array.from(store.values())
          .filter((doc) => String(doc.questionId) === String(questionId))
          .slice(offset, offset + limit);
      },
    ),

    findByQuestionIds: mock(
      async (
        questionIds: (Types.ObjectId | string)[],
        _sort: Record<string, 'asc' | 'desc'> = { createdAt: 'asc' },
        limit = 100,
        offset = 0,
      ) => {
        return Array.from(store.values())
          .filter((doc) => {
            // The real repository only narrows the query when the list is not empty.
            if (questionIds.length === 0) return true;

            return questionIds.some((id) => String(doc.questionId) === String(id));
          })
          .slice(offset, offset + limit);
      },
    ),

    findByUserId: mock(
      async (userId: string, _sort: Record<string, 'asc' | 'desc'> = { createdAt: 'asc' }, limit = 100, offset = 0) => {
        return Array.from(store.values())
          .filter((doc) => doc.userId === userId)
          .slice(offset, offset + limit);
      },
    ),

    countByQuestionId: mock(async (questionId: string) => {
      return Array.from(store.values()).filter((doc) => String(doc.questionId) === String(questionId)).length;
    }),
  };

  return repository;
}

export type FakeQuestionLikesRepository = ReturnType<typeof createFakeQuestionLikesRepository>;
