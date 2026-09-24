/**
 * In-memory fake of UserRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/user.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';
import { AppError } from '@shared/errors/app-errors';

export type FakeUserDoc = {
  _id: Types.ObjectId;
  wallet: string;
  createdAt: number;
  updatedAt: number;
};

export function createFakeUserRepository() {
  const store = new Map<string, FakeUserDoc>();

  const notFound = (id: string) =>
    new AppError({ message: `User ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });

  // Mirrors the real queries ({ wallet: wallet.toLowerCase() }) — wallets are stored lowercased.
  const byWallet = (wallet: string) => Array.from(store.values()).find((doc) => doc.wallet === wallet.toLowerCase());

  const now = () => Math.floor(Date.now() / 1000);

  const repository = {
    store,

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

    findByWallet: mock(async (wallet: string) => {
      const doc = byWallet(wallet);
      if (!doc) {
        throw new AppError({
          message: `User ${wallet} not found`,
          statusCode: 404,
          code: 'NOT_FOUND',
        });
      }

      return doc;
    }),

    exists: mock(async (wallet: string): Promise<boolean> => {
      return byWallet(wallet) !== undefined;
    }),

    findOrCreate: mock(async (wallet: string) => {
      const existing = byWallet(wallet);
      if (existing) return existing;

      const timestamp = now();
      const doc: FakeUserDoc = {
        _id: new Types.ObjectId(),
        wallet: wallet.toLowerCase(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      store.set(doc._id.toString(), doc);

      return doc;
    }),
  };

  return repository;
}

export type FakeUserRepository = ReturnType<typeof createFakeUserRepository>;
