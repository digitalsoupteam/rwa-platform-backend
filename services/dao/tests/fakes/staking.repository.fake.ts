/**
 * In-memory fake of StakingRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/staking.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 *
 * Amounts are kept as decimal strings: the real repository stores Decimal128
 * and the service only calls .toString() before returning them to callers.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';

export type FakeStakingDoc = {
  _id: Types.ObjectId;
  staker: string;
  amount: string;
  lastStakeTimestamp: number;
  chainId: string;
  createdAt: number;
  updatedAt: number;
};

const DECIMALS = 18n;
const SCALE = 10n ** DECIMALS;

/** Parses a decimal string into a scaled integer (18 fractional digits). */
function toScaled(value: string): bigint {
  const negative = value.startsWith('-');
  const digits = negative ? value.slice(1) : value;
  const [whole = '0', fraction = ''] = digits.split('.');
  const paddedFraction = (fraction + '0'.repeat(Number(DECIMALS))).slice(0, Number(DECIMALS));
  const scaled = BigInt(whole === '' ? '0' : whole) * SCALE + BigInt(paddedFraction === '' ? '0' : paddedFraction);
  return negative ? -scaled : scaled;
}

/** Formats a scaled integer back into the shortest decimal string. */
function fromScaled(scaled: bigint): string {
  const negative = scaled < 0n;
  const absolute = negative ? -scaled : scaled;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE)
    .toString()
    .padStart(Number(DECIMALS), '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction === '' ? '' : `.${fraction}`}`;
}

/**
 * The real repository lets MongoDB do the arithmetic ($inc over Decimal128);
 * the fake reproduces the observable outcome in memory.
 */
function addDecimalStrings(left: string, right: string): string {
  return fromScaled(toScaled(left) + toScaled(right));
}

function negateDecimalString(value: string): string {
  return value.startsWith('-') ? value.slice(1) : `-${value}`;
}

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ staker }, { chainId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeStakingRepository() {
  // Keyed by `${staker}|${chainId}`: the real collection has a unique index on { chainId, staker }.
  const store = new Map<string, FakeStakingDoc>();
  const keyOf = (staker: string, chainId: string) => `${staker}|${chainId}`;

  const repository = {
    store,
    keyOf,

    addStake: mock(async (staker: string, chainId: string, amount: string, lastStakeTimestamp: number) => {
      const key = keyOf(staker, chainId);
      const existing = store.get(key);
      const timestamp = Math.floor(Date.now() / 1000);

      const doc: FakeStakingDoc = existing
        ? { ...existing, amount: addDecimalStrings(existing.amount, amount), lastStakeTimestamp, updatedAt: timestamp }
        : {
            _id: new Types.ObjectId(),
            staker,
            chainId,
            amount,
            lastStakeTimestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

      store.set(key, doc);
      return doc;
    }),

    subStake: mock(async (staker: string, chainId: string, amount: string) => {
      const key = keyOf(staker, chainId);
      const existing = store.get(key);
      const timestamp = Math.floor(Date.now() / 1000);

      // The real findOneAndUpdate upserts: subtracting from a missing record
      // creates it with a negative amount and without lastStakeTimestamp
      // (update validators are not run for findOneAndUpdate).
      const doc: FakeStakingDoc = existing
        ? { ...existing, amount: addDecimalStrings(existing.amount, negateDecimalString(amount)), updatedAt: timestamp }
        : {
            _id: new Types.ObjectId(),
            staker,
            chainId,
            amount: negateDecimalString(amount),
            lastStakeTimestamp: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

      store.set(key, doc);
      return doc;
    }),

    findAll: mock(
      async (
        filter: Record<string, unknown> = {},
        _sort: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' },
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

export type FakeStakingRepository = ReturnType<typeof createFakeStakingRepository>;
