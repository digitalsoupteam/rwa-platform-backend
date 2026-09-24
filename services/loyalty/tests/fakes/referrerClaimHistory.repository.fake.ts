/**
 * In-memory fake of ReferrerClaimHistoryRepository for unit tests.
 *
 * The real repository talks to MongoDB and converts the incoming amount string
 * to Decimal128 before creating the document. This fake mirrors that behavior
 * in memory. The public API mirrors
 * src/repositories/referrerClaimHistory.repository.ts, and every method is
 * wrapped in bun:test mock() so interactions can be asserted.
 *
 * The unique (transactionHash + logIndex + chainId) index is not enforced by
 * the fake: tests that need a duplicate-key failure inject it per call with
 * `claims.create.mockImplementationOnce(...)` and `{ code: 11000 }`.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';

export type FakeReferrerClaimHistoryDoc = {
  _id: Types.ObjectId;
  referrerWallet: string;
  referrerId: string;
  chainId: string;
  tokenAddress: string;
  referralWallet: string;
  amount: Types.Decimal128;
  transactionHash: string;
  logIndex: number;
  blockNumber: number;
  createdAt: number;
  updatedAt: number;
};

export type CreateReferrerClaimHistoryInput = {
  referrerWallet: string;
  referrerId: string;
  chainId: string;
  tokenAddress: string;
  referralWallet: string;
  amount: string;
  transactionHash: string;
  logIndex: number;
  blockNumber: number;
};

export type SeedReferrerClaimHistoryInput = {
  referrerWallet: string;
  referrerId: string;
  referralWallet?: string;
  chainId: string;
  tokenAddress: string;
  amount?: string;
  transactionHash?: string;
  logIndex?: number;
  blockNumber?: number;
  createdAt?: number;
  updatedAt?: number;
};

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ referrerId }, { chainId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeReferrerClaimHistoryRepository() {
  const store = new Map<string, FakeReferrerClaimHistoryDoc>();

  const insert = (input: SeedReferrerClaimHistoryInput): FakeReferrerClaimHistoryDoc => {
    const now = Math.floor(Date.now() / 1000);
    const doc: FakeReferrerClaimHistoryDoc = {
      _id: new Types.ObjectId(),
      referrerWallet: input.referrerWallet,
      referrerId: input.referrerId,
      chainId: input.chainId,
      tokenAddress: input.tokenAddress,
      referralWallet: input.referralWallet ?? input.referrerWallet,
      amount: Types.Decimal128.fromString(input.amount ?? '0'),
      transactionHash: input.transactionHash ?? '0x',
      logIndex: input.logIndex ?? 0,
      blockNumber: input.blockNumber ?? 0,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };
    store.set(doc._id.toString(), doc);
    return doc;
  };

  const repository = {
    store,

    /** Insert a document directly, bypassing the mocks (interaction counts stay untouched). */
    seed: (input: SeedReferrerClaimHistoryInput): FakeReferrerClaimHistoryDoc => insert(input),

    create: mock(async (data: CreateReferrerClaimHistoryInput) => insert(data)),

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

export type FakeReferrerClaimHistoryRepository = ReturnType<typeof createFakeReferrerClaimHistoryRepository>;
