/**
 * In-memory fake of PermissionRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/permissions.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakePermissionDoc = {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  memberId: Types.ObjectId;
  userId: string;
  permission: string;
  entity: string;
  createdAt: number;
  updatedAt: number;
};

export type CreatePermissionInput = {
  companyId: Types.ObjectId | string;
  memberId: Types.ObjectId | string;
  userId: string;
  permission: string;
  entity?: string;
};

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ companyId }, { memberId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakePermissionRepository() {
  const store = new Map<string, FakePermissionDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `Permission ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    create: mock(async (data: CreatePermissionInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakePermissionDoc = {
        _id: new Types.ObjectId(),
        companyId: new Types.ObjectId(data.companyId),
        memberId: new Types.ObjectId(data.memberId),
        userId: data.userId,
        permission: data.permission,
        entity: data.entity ?? '*', // mirrors the schema default: '*'
        createdAt: now,
        updatedAt: now,
      };
      store.set(doc._id.toString(), doc);
      return doc;
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

export type FakePermissionRepository = ReturnType<typeof createFakePermissionRepository>;
