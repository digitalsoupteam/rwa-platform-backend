/**
 * In-memory fake of EndpointRepository for unit tests.
 *
 * The real repository talks to MongoDB through the WebhookEndpoint model.
 * Tests use this fake to keep the service and daemon layers isolated: no
 * database, no network, deterministic results. The public API mirrors
 * src/repositories/endpoint.repository.ts, and every method is wrapped in
 * bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeEndpointDoc = {
  _id: Types.ObjectId;
  userId: string;
  wallet: string;
  url: string;
  secret: string;
  events: string[];
  description: string;
  active: boolean;
  rateLimitPerMinute: number;
  consecutiveFailures: number;
  maxAttempts: number;
  createdAt: number;
  updatedAt: number;
};

export type CreateEndpointInput = Pick<FakeEndpointDoc, 'userId' | 'wallet' | 'url' | 'secret' | 'events'> &
  Partial<Pick<FakeEndpointDoc, 'description' | 'rateLimitPerMinute'>>;

export type UpdateEndpointInput = Partial<
  Pick<
    FakeEndpointDoc,
    'url' | 'secret' | 'events' | 'description' | 'active' | 'rateLimitPerMinute' | 'consecutiveFailures'
  >
>;

export function createFakeEndpointRepository() {
  const store = new Map<string, FakeEndpointDoc>();

  const now = () => Math.floor(Date.now() / 1000);

  const notFound = (id: string) =>
    new AppError({ message: `Webhook endpoint ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    createEndpoint: mock(async (data: CreateEndpointInput) => {
      // The real model applies these defaults on create (see endpoint.entity.ts).
      const doc: FakeEndpointDoc = {
        _id: new Types.ObjectId(),
        userId: data.userId,
        wallet: data.wallet,
        url: data.url,
        secret: data.secret,
        events: [...data.events],
        description: data.description ?? '',
        active: true,
        rateLimitPerMinute: data.rateLimitPerMinute ?? 100,
        consecutiveFailures: 0,
        maxAttempts: 8,
        createdAt: now(),
        updatedAt: now(),
      };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    findById: mock(async (id: string) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      return doc;
    }),

    findAll: mock(async (filters: { userId: string }) => {
      return Array.from(store.values()).filter((doc) => doc.userId === filters.userId);
    }),

    findByEvents: mock(async (eventType: string) => {
      // Mirrors the real query: { events: eventType, active: true }.
      return Array.from(store.values()).filter((doc) => doc.events.includes(eventType) && doc.active);
    }),

    updateEndpoint: mock(async (id: string, data: UpdateEndpointInput) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      // Mirrors findByIdAndUpdate(id, { $set: { ...data, updatedAt } }, { new: true }).
      const next: FakeEndpointDoc = { ...doc, ...data, updatedAt: now() };
      store.set(id, next);
      return next;
    }),

    deleteEndpoint: mock(async (id: string) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      store.delete(id);
      return doc;
    }),

    countByUser: mock(async (userId: string) => {
      return Array.from(store.values()).filter((doc) => doc.userId === userId).length;
    }),
  };

  return repository;
}

export type FakeEndpointRepository = ReturnType<typeof createFakeEndpointRepository>;
