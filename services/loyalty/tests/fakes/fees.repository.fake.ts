/**
 * In-memory fake of FeesRepository for unit tests.
 *
 * The real repository talks to MongoDB and upserts one document per
 * (userWallet, userId, chainId, tokenAddress) key, incrementing counters and
 * Decimal128 amounts with $inc. This fake reproduces that document shape and
 * the upsert semantics in memory; Decimal128 amounts are kept exact for the
 * integer values used across loyalty tests.
 * The public API mirrors src/repositories/fees.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';

export type FakeFeesDoc = {
  _id: Types.ObjectId;
  userWallet: string;
  userId: string;
  chainId: string;
  tokenAddress: string;
  buyCommissionAmount: Types.Decimal128;
  sellCommissionAmount: Types.Decimal128;
  tokenCreationCommissionAmount: Types.Decimal128;
  poolCreationCommissionAmount: Types.Decimal128;
  referralRewardAmount: Types.Decimal128;
  buyCommissionCount: number;
  sellCommissionCount: number;
  tokenCreationCommissionCount: number;
  poolCreationCommissionCount: number;
  referralRewardCount: number;
  createdAt: number;
  updatedAt: number;
};

export type SeedFeesInput = {
  userWallet: string;
  userId: string;
  chainId: string;
  tokenAddress: string;
  buyCommissionAmount?: string;
  sellCommissionAmount?: string;
  tokenCreationCommissionAmount?: string;
  poolCreationCommissionAmount?: string;
  referralRewardAmount?: string;
  buyCommissionCount?: number;
  sellCommissionCount?: number;
  tokenCreationCommissionCount?: number;
  poolCreationCommissionCount?: number;
  referralRewardCount?: number;
  createdAt?: number;
  updatedAt?: number;
};

type CommissionKind = 'buy' | 'sell' | 'tokenCreation' | 'poolCreation' | 'referralReward';

/** Adds two decimal strings; integers (the event values) stay exact via BigInt. */
function addDecimal(current: Types.Decimal128, amount: string): Types.Decimal128 {
  const base = current.toString();
  const sum =
    /^-?\d+$/.test(base) && /^-?\d+$/.test(amount) ? BigInt(base) + BigInt(amount) : Number(base) + Number(amount);
  return Types.Decimal128.fromString(String(sum));
}

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ userWallet }, { tokenAddress }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeFeesRepository() {
  const store = new Map<string, FakeFeesDoc>();

  const insert = (input: SeedFeesInput): FakeFeesDoc => {
    const now = Math.floor(Date.now() / 1000);
    const doc: FakeFeesDoc = {
      _id: new Types.ObjectId(),
      userWallet: input.userWallet,
      userId: input.userId,
      chainId: input.chainId,
      tokenAddress: input.tokenAddress,
      buyCommissionAmount: Types.Decimal128.fromString(input.buyCommissionAmount ?? '0'),
      sellCommissionAmount: Types.Decimal128.fromString(input.sellCommissionAmount ?? '0'),
      tokenCreationCommissionAmount: Types.Decimal128.fromString(input.tokenCreationCommissionAmount ?? '0'),
      poolCreationCommissionAmount: Types.Decimal128.fromString(input.poolCreationCommissionAmount ?? '0'),
      referralRewardAmount: Types.Decimal128.fromString(input.referralRewardAmount ?? '0'),
      buyCommissionCount: input.buyCommissionCount ?? 0,
      sellCommissionCount: input.sellCommissionCount ?? 0,
      tokenCreationCommissionCount: input.tokenCreationCommissionCount ?? 0,
      poolCreationCommissionCount: input.poolCreationCommissionCount ?? 0,
      referralRewardCount: input.referralRewardCount ?? 0,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };
    store.set(doc._id.toString(), doc);
    return doc;
  };

  const findByKey = (userWallet: string, userId: string, chainId: string, tokenAddress: string): FakeFeesDoc | null => {
    for (const doc of store.values()) {
      if (
        doc.userWallet === userWallet &&
        doc.userId === userId &&
        doc.chainId === chainId &&
        doc.tokenAddress === tokenAddress
      ) {
        return doc;
      }
    }
    return null;
  };

  /** Mirrors the $inc upsert of the real repository for one commission kind. */
  const applyCommission = (
    kind: CommissionKind,
    userWallet: string,
    userId: string,
    chainId: string,
    tokenAddress: string,
    amount: string,
  ): FakeFeesDoc => {
    const doc =
      findByKey(userWallet, userId, chainId, tokenAddress) ?? insert({ userWallet, userId, chainId, tokenAddress });

    if (kind === 'buy') {
      doc.buyCommissionCount += 1;
      doc.buyCommissionAmount = addDecimal(doc.buyCommissionAmount, amount);
    } else if (kind === 'sell') {
      doc.sellCommissionCount += 1;
      doc.sellCommissionAmount = addDecimal(doc.sellCommissionAmount, amount);
    } else if (kind === 'tokenCreation') {
      doc.tokenCreationCommissionCount += 1;
      doc.tokenCreationCommissionAmount = addDecimal(doc.tokenCreationCommissionAmount, amount);
    } else if (kind === 'poolCreation') {
      doc.poolCreationCommissionCount += 1;
      doc.poolCreationCommissionAmount = addDecimal(doc.poolCreationCommissionAmount, amount);
    } else {
      doc.referralRewardCount += 1;
      doc.referralRewardAmount = addDecimal(doc.referralRewardAmount, amount);
    }

    doc.updatedAt = Math.floor(Date.now() / 1000);
    store.set(doc._id.toString(), doc);
    return doc;
  };

  const repository = {
    store,

    /** Insert a document directly, bypassing the mocks (interaction counts stay untouched). */
    seed: (input: SeedFeesInput): FakeFeesDoc => insert(input),

    addBuyCommission: mock(
      async (userWallet: string, userId: string, chainId: string, tokenAddress: string, amount: string) =>
        applyCommission('buy', userWallet, userId, chainId, tokenAddress, amount),
    ),

    addSellCommission: mock(
      async (userWallet: string, userId: string, chainId: string, tokenAddress: string, amount: string) =>
        applyCommission('sell', userWallet, userId, chainId, tokenAddress, amount),
    ),

    addTokenCreationCommission: mock(
      async (userWallet: string, userId: string, chainId: string, tokenAddress: string, amount: string) =>
        applyCommission('tokenCreation', userWallet, userId, chainId, tokenAddress, amount),
    ),

    addPoolCreationCommission: mock(
      async (userWallet: string, userId: string, chainId: string, tokenAddress: string, amount: string) =>
        applyCommission('poolCreation', userWallet, userId, chainId, tokenAddress, amount),
    ),

    addReferralReward: mock(
      async (userWallet: string, userId: string, chainId: string, tokenAddress: string, amount: string) =>
        applyCommission('referralReward', userWallet, userId, chainId, tokenAddress, amount),
    ),

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

export type FakeFeesRepository = ReturnType<typeof createFakeFeesRepository>;
