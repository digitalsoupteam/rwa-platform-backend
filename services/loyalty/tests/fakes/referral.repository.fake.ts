/**
 * In-memory fake of ReferralRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/referral.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';

export type FakeReferralDoc = {
  _id: Types.ObjectId;
  userWallet: string;
  userId: string;
  referrerWallet?: string;
  referrerId?: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateReferralInput = Pick<FakeReferralDoc, 'userWallet' | 'userId' | 'referrerWallet' | 'referrerId'>;

export type SeedReferralInput = {
  userWallet: string;
  userId: string;
  referrerWallet?: string;
  referrerId?: string;
  createdAt?: number;
  updatedAt?: number;
};

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ userWallet }, { userId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeReferralRepository() {
  const store = new Map<string, FakeReferralDoc>();

  const insert = (input: SeedReferralInput): FakeReferralDoc => {
    const now = Math.floor(Date.now() / 1000);
    const doc: FakeReferralDoc = {
      _id: new Types.ObjectId(),
      userWallet: input.userWallet,
      userId: input.userId,
      referrerWallet: input.referrerWallet,
      referrerId: input.referrerId,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };
    store.set(doc._id.toString(), doc);
    return doc;
  };

  const findOne = (predicate: (doc: FakeReferralDoc) => boolean): FakeReferralDoc | null => {
    for (const doc of store.values()) {
      if (predicate(doc)) return doc;
    }
    return null;
  };

  const repository = {
    store,

    /** Insert a document directly, bypassing the mocks (interaction counts stay untouched). */
    seed: (input: SeedReferralInput): FakeReferralDoc => insert(input),

    create: mock(async (data: CreateReferralInput) => insert(data)),

    // The real repository resolves null when nothing matches (`.lean()` result or null).
    findByUserWallet: mock(async (userWallet: string) => findOne((doc) => doc.userWallet === userWallet)),

    findByReferrerWallet: mock(async (referrerWallet: string) =>
      findOne((doc) => doc.referrerWallet === referrerWallet),
    ),

    findByUserId: mock(async (userId: string) => findOne((doc) => doc.userId === userId)),

    findAll: mock(
      async (
        filter: Record<string, unknown> = {},
        _sort: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' },
        limit = 100,
        offset = 0,
      ) => {
        return Array.from(store.values())
          .filter((doc) => matchesFilter(doc as unknown as Record<string, unknown>, filter))
          .slice(offset, offset + limit);
      },
    ),
  };

  return repository;
}

export type FakeReferralRepository = ReturnType<typeof createFakeReferralRepository>;
