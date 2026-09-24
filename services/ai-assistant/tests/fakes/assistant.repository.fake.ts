/**
 * In-memory fake of AssistantRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/assistant.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';
import type { AssistantContext } from '../../src/models/shared/enums.model';

export type FakeAssistantDoc = {
  _id: Types.ObjectId;
  userId: string;
  name: string;
  contextPreferences: AssistantContext;
  createdAt: number;
  updatedAt: number;
};

export type CreateAssistantInput = Pick<FakeAssistantDoc, 'userId' | 'name' | 'contextPreferences'>;
export type UpdateAssistantInput = Partial<Pick<FakeAssistantDoc, 'name' | 'contextPreferences'>>;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ userId }).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

function omitUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  // Mongoose strips undefined values from update payloads; the fake mirrors that
  // so optional fields omitted by callers keep their stored value.
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export function createFakeAssistantRepository() {
  const store = new Map<string, FakeAssistantDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `Assistant ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    create: mock(async (data: CreateAssistantInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeAssistantDoc = { _id: new Types.ObjectId(), createdAt: now, updatedAt: now, ...data };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    update: mock(async (id: string, data: UpdateAssistantInput) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const next: FakeAssistantDoc = {
        ...doc,
        ...omitUndefined(data),
        updatedAt: Math.floor(Date.now() / 1000),
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
  };

  return repository;
}

export type FakeAssistantRepository = ReturnType<typeof createFakeAssistantRepository>;
