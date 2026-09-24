/**
 * In-memory fake of CommissionHistoryRepository for unit tests.
 *
 * The real repository talks to MongoDB and converts the incoming amount string
 * to Decimal128 before creating the document. This fake mirrors that behavior
 * in memory. The public API mirrors
 * src/repositories/commissionHistory.repository.ts, and every method is
 * wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';

export type FakeCommissionHistoryDoc = {
  _id: Types.ObjectId;
  userWallet: string;
  userId: string;
  chainId: string;
  tokenAddress: string;
  amount: Types.Decimal128;
  actionType: string;
  transactionHash: string;
  relatedUserWallet?: string;
  relatedUserId?: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateCommissionHistoryInput = {
  userWallet: string;
  userId: string;
  chainId: string;
  tokenAddress: string;
  amount: string;
  actionType: string;
  transactionHash: string;
  relatedUserWallet?: string;
  relatedUserId?: string;
};

export type SeedCommissionHistoryInput = {
  userWallet: string;
  userId: string;
  chainId: string;
  tokenAddress: string;
  amount?: string;
  actionType: string;
  transactionHash?: string;
  relatedUserWallet?: string;
  relatedUserId?: string;
  createdAt?: number;
  updatedAt?: number;
};

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ userWallet }, { actionType }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeCommissionHistoryRepository() {
  const store = new Map<string, FakeCommissionHistoryDoc>();

  const insert = (input: SeedCommissionHistoryInput): FakeCommissionHistoryDoc => {
    const now = Math.floor(Date.now() / 1000);
    const doc: FakeCommissionHistoryDoc = {
      _id: new Types.ObjectId(),
      userWallet: input.userWallet,
      userId: input.userId,
      chainId: input.chainId,
      tokenAddress: input.tokenAddress,
      amount: Types.Decimal128.fromString(input.amount ?? '0'),
      actionType: input.actionType,
      transactionHash: input.transactionHash ?? '0x',
      relatedUserWallet: input.relatedUserWallet,
      relatedUserId: input.relatedUserId,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };
    store.set(doc._id.toString(), doc);
    return doc;
  };

  const repository = {
    store,

    /** Insert a document directly, bypassing the mocks (interaction counts stay untouched). */
    seed: (input: SeedCommissionHistoryInput): FakeCommissionHistoryDoc => insert(input),

    create: mock(async (data: CreateCommissionHistoryInput) => insert(data)),

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

export type FakeCommissionHistoryRepository = ReturnType<typeof createFakeCommissionHistoryRepository>;
