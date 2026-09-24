/**
 * In-memory fake of MessageRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/message.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';
import type { MessageSender } from '../../src/models/shared/enums.model';

export type FakeMessageDoc = {
  _id: Types.ObjectId;
  assistantId: string;
  text: string;
  sender: MessageSender;
  createdAt: number;
  updatedAt: number;
};

export type CreateMessageInput = Pick<FakeMessageDoc, 'assistantId' | 'text' | 'sender'>;
export type UpdateMessageInput = Pick<FakeMessageDoc, 'text'>;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ assistantId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeMessageRepository() {
  const store = new Map<string, FakeMessageDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `Message ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    create: mock(async (data: CreateMessageInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeMessageDoc = { _id: new Types.ObjectId(), createdAt: now, updatedAt: now, ...data };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    update: mock(async (id: string, data: UpdateMessageInput) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const next: FakeMessageDoc = { ...doc, ...data, updatedAt: Math.floor(Date.now() / 1000) };
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

    findByAssistantId: mock(
      async (
        assistantId: string,
        _sort: Record<string, 'asc' | 'desc'> = { createdAt: 'asc' },
        limit = 100,
        offset = 0,
      ) => {
        // The fake does not implement sorting: docs come back in insertion order
        // (same convention as the faq pilot fakes), sliced by offset/limit.
        return Array.from(store.values())
          .filter((doc) => doc.assistantId === assistantId)
          .slice(offset, offset + limit);
      },
    ),

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

export type FakeMessageRepository = ReturnType<typeof createFakeMessageRepository>;
