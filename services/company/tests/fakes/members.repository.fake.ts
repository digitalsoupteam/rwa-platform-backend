/**
 * In-memory fake of MemberRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/members.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeMemberDoc = {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateMemberInput = { companyId: Types.ObjectId | string } & Pick<FakeMemberDoc, 'userId' | 'name'>;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ companyId }, { userId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeMemberRepository() {
  const store = new Map<string, FakeMemberDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `Member ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    create: mock(async (data: CreateMemberInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeMemberDoc = {
        _id: new Types.ObjectId(),
        companyId: new Types.ObjectId(data.companyId), // mongoose casts the company ref to ObjectId
        userId: data.userId,
        name: data.name,
        createdAt: now,
        updatedAt: now,
      };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    update: mock(async (id: string, data: Partial<Pick<FakeMemberDoc, 'name'>>) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const next: FakeMemberDoc = { ...doc, ...data, updatedAt: Math.floor(Date.now() / 1000) };
      store.set(id, next);
      return next;
    }),

    delete: mock(async (id: string) => {
      if (!store.has(id)) throw notFound(id);

      store.delete(id);
      return id;
    }),

    deleteMany: mock(async (filter: Record<string, unknown> = {}) => {
      let deletedCount = 0;

      for (const [key, doc] of store) {
        if (!matchesFilter(doc, filter)) continue;

        store.delete(key);
        deletedCount += 1;
      }

      return deletedCount;
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
        limit?: number,
        offset?: number,
      ) => {
        let result = Array.from(store.values()).filter((doc) => matchesFilter(doc, filter));

        // Mirrors the real repository: skip/limit are only applied when provided.
        if (typeof offset === 'number') result = result.slice(offset);
        if (typeof limit === 'number') result = result.slice(0, limit);

        return result;
      },
    ),
  };

  return repository;
}

export type FakeMemberRepository = ReturnType<typeof createFakeMemberRepository>;
