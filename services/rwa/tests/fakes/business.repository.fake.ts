/**
 * In-memory fake of BusinessRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/business.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeBusinessDoc = {
  _id: Types.ObjectId;
  ownerId: string;
  ownerType: string;
  ownerWallet?: string;
  chainId: string;
  name: string;
  tokenAddress?: string;
  description: string;
  tags: string[];
  riskScore?: number;
  image?: string;
  fileId?: string;
  approvalSignaturesTaskId?: string;
  approvalSignaturesTaskExpired?: number;
  riskScoreEvaluationProcess: boolean;
  riskScoreEvaluationStartedAt: number;
  country?: string;
  businessType?: string;
  socials: { type: string; url: string }[];
  paused: boolean;
  createdAt: number;
  updatedAt: number;
};

export type CreateBusinessInput = Omit<Partial<FakeBusinessDoc>, '_id' | 'createdAt' | 'updatedAt'> &
  Pick<FakeBusinessDoc, 'ownerId' | 'ownerType' | 'name' | 'chainId'>;

export type UpdateBusinessInput = Partial<
  Pick<
    FakeBusinessDoc,
    | 'chainId'
    | 'ownerWallet'
    | 'name'
    | 'tokenAddress'
    | 'description'
    | 'tags'
    | 'image'
    | 'fileId'
    | 'riskScore'
    | 'approvalSignaturesTaskId'
    | 'approvalSignaturesTaskExpired'
    | 'riskScoreEvaluationProcess'
    | 'riskScoreEvaluationStartedAt'
    | 'country'
    | 'businessType'
    | 'socials'
    | 'paused'
  >
>;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ ownerId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeBusinessRepository() {
  const store = new Map<string, FakeBusinessDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `Business ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  const repository = {
    store,

    createBusiness: mock(async (data: CreateBusinessInput) => {
      const now = Math.floor(Date.now() / 1000);
      const doc: FakeBusinessDoc = {
        // Defaults mirror the mongoose schema defaults of BusinessEntity.
        description: '',
        tags: [],
        socials: [],
        paused: false,
        riskScoreEvaluationProcess: false,
        riskScoreEvaluationStartedAt: 0,
        ...data,
        _id: new Types.ObjectId(),
        createdAt: now,
        updatedAt: now,
      };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    updateBusiness: mock(async (id: string, data: UpdateBusinessInput) => {
      const doc = store.get(id);
      if (!doc) throw notFound(id);

      // Spread semantics: an explicit `undefined` in `data` sets the key to
      // undefined in the fake (mongoose itself may ignore undefined update
      // keys; tests assert the forwarded call arguments for such flows).
      const next: FakeBusinessDoc = { ...doc, ...data, updatedAt: Math.floor(Date.now() / 1000) };
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

export type FakeBusinessRepository = ReturnType<typeof createFakeBusinessRepository>;
