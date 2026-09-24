/**
 * In-memory fake of ReactionRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/reaction.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeReactionDoc = {
  _id: Types.ObjectId;
  parentId: string;
  parentType: string;
  userId: string;
  reaction: string;
  createdAt: number;
  updatedAt: number;
};

export type ReactionKeyInput = Pick<FakeReactionDoc, 'parentId' | 'parentType' | 'userId' | 'reaction'>;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ parentId }, { parentId, userId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

function sameKey(doc: FakeReactionDoc, data: ReactionKeyInput): boolean {
  return (
    String(doc.parentId) === String(data.parentId) &&
    String(doc.parentType) === String(data.parentType) &&
    String(doc.userId) === String(data.userId) &&
    String(doc.reaction) === String(data.reaction)
  );
}

export function createFakeReactionRepository() {
  const store = new Map<string, FakeReactionDoc>();

  // Mirrors the NOT_FOUND raised by ReactionRepository.delete().
  const notFound = (data: ReactionKeyInput) =>
    new AppError({
      message: `Reaction ${data.parentId}:${data.userId}:${data.reaction} not found`,
      statusCode: 404,
      code: 'NOT_FOUND',
    });

  const repository = {
    store,

    create: mock(async (data: ReactionKeyInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeReactionDoc = {
        _id: new Types.ObjectId(),
        parentId: data.parentId,
        parentType: data.parentType,
        userId: data.userId,
        reaction: data.reaction,
        createdAt: now,
        updatedAt: now,
      };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    delete: mock(async (data: ReactionKeyInput) => {
      const doc = Array.from(store.values()).find((candidate) => sameKey(candidate, data));
      if (!doc) throw notFound(data);

      store.delete(doc._id.toString());
      return doc;
    }),

    getEntityStats: mock(async (parentId: string, parentType: string): Promise<Record<string, number>> => {
      const stats: Record<string, number> = {};
      for (const doc of store.values()) {
        if (!matchesFilter(doc, { parentId, parentType })) continue;

        stats[doc.reaction] = (stats[doc.reaction] ?? 0) + 1;
      }
      return stats;
    }),

    getUserReaction: mock(async (parentId: string, userId: string) => {
      return Array.from(store.values()).filter((doc) => matchesFilter(doc, { parentId, userId }));
    }),

    findAll: mock(
      async (
        filter: Record<string, unknown> = {},
        _sort: { [key: string]: any } = { createdAt: 'desc' },
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

export type FakeReactionRepository = ReturnType<typeof createFakeReactionRepository>;
