/**
 * In-memory fake of EvaluationRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the service
 * layer isolated: no database, no network, deterministic results. The public API
 * mirrors src/repositories/evaluation.repository.ts, and every method is wrapped
 * in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeEntityType = 'pool' | 'business';
export type FakeEvaluationStatus = 'pending' | 'completed' | 'failed';

export type FakeEvaluationFactor = {
  name: string;
  impact: string;
  detail: string;
};

export type FakeEvaluatedDocument = {
  id: string;
  name: string;
  mimeType: string;
};

export type FakeEvaluatedImage = {
  id: string;
  name: string;
};

export type FakeEvaluationDoc = {
  _id: Types.ObjectId;
  entityType: FakeEntityType;
  parentId: string;
  grandParentId: string;
  ownerId: string;
  ownerType: string;
  status: FakeEvaluationStatus;
  riskScore?: number;
  reasoning?: string;
  factors: FakeEvaluationFactor[];
  stage1Response?: string;
  stage2Response?: string;
  evaluatedDocuments: FakeEvaluatedDocument[];
  evaluatedImages: FakeEvaluatedImage[];
  modelUsed?: string;
  createdAt: number;
  updatedAt: number;
};

/** Same shape the real repository accepts: everything but the mongo-managed fields. */
export type CreateEvaluationInput = Partial<Omit<FakeEvaluationDoc, '_id' | 'createdAt' | 'updatedAt'>> &
  Pick<FakeEvaluationDoc, 'entityType' | 'parentId' | 'grandParentId' | 'ownerId' | 'ownerType'>;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ parentId }, { entityType }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeEvaluationRepository() {
  const store = new Map<string, FakeEvaluationDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `Evaluation ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    create: mock(async (data: CreateEvaluationInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeEvaluationDoc = {
        ...data,
        _id: new Types.ObjectId(),
        status: data.status ?? 'pending',
        factors: data.factors ?? [],
        evaluatedDocuments: data.evaluatedDocuments ?? [],
        evaluatedImages: data.evaluatedImages ?? [],
        createdAt: now,
        updatedAt: now,
      };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    updateById: mock(async (id: string, data: Partial<FakeEvaluationDoc>) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      const next: FakeEvaluationDoc = { ...doc, ...data, updatedAt: Math.floor(Date.now() / 1000) };
      store.set(id, next);
      return next;
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

export type FakeEvaluationRepository = ReturnType<typeof createFakeEvaluationRepository>;
