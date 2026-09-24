/**
 * In-memory fake of DeliveryLogRepository for unit tests.
 *
 * The real repository talks to MongoDB through the WebhookDeliveryLog model.
 * Tests use this fake to keep the service and daemon layers isolated: no
 * database, no network, deterministic results. The public API mirrors
 * src/repositories/deliveryLog.repository.ts, and every method is wrapped in
 * bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';

export type FakeDeliveryAttempt = {
  timestamp: number;
  statusCode?: number;
  responseBody?: string;
  error?: string;
};

export type FakeDeliveryLogDoc = {
  _id: Types.ObjectId;
  endpointId: Types.ObjectId;
  eventType: string;
  eventId: string;
  payload: unknown;
  status: string;
  attempts: FakeDeliveryAttempt[];
  nextRetryAt: number | null;
  createdAt: number;
};

export type CreateDeliveryLogInput = {
  endpointId: string | Types.ObjectId;
  eventType: string;
  eventId: string;
  payload: unknown;
  status?: string;
};

export function createFakeDeliveryLogRepository() {
  const store = new Map<string, FakeDeliveryLogDoc>();

  const now = () => Math.floor(Date.now() / 1000);

  const repository = {
    store,

    createDeliveryLog: mock(async (data: CreateDeliveryLogInput) => {
      const doc: FakeDeliveryLogDoc = {
        _id: new Types.ObjectId(),
        endpointId: new Types.ObjectId(data.endpointId),
        eventType: data.eventType,
        eventId: data.eventId,
        payload: data.payload,
        status: data.status ?? 'pending',
        attempts: [],
        nextRetryAt: null,
        createdAt: now(),
      };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    // The real repository returns a lean doc or null — it does not throw.
    findById: mock(async (id: string) => store.get(id) ?? null),

    findByEndpointId: mock(async (endpointId: string) => {
      return Array.from(store.values())
        .filter((doc) => doc.endpointId.toString() === endpointId)
        .sort((a, b) => b.createdAt - a.createdAt);
    }),

    updateStatus: mock(async (id: string, data: Partial<Pick<FakeDeliveryLogDoc, 'status' | 'nextRetryAt'>>) => {
      const doc = store.get(id);
      if (!doc) return null;

      const next: FakeDeliveryLogDoc = { ...doc, ...data };
      store.set(id, next);
      return next;
    }),

    pushAttempt: mock(async (id: string, attempt: FakeDeliveryAttempt) => {
      const doc = store.get(id);
      if (!doc) return null;

      const next: FakeDeliveryLogDoc = { ...doc, attempts: [...doc.attempts, attempt] };
      store.set(id, next);
      return next;
    }),
  };

  return repository;
}

export type FakeDeliveryLogRepository = ReturnType<typeof createFakeDeliveryLogRepository>;
