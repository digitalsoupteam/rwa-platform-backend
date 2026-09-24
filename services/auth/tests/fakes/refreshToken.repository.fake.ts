/**
 * In-memory fake of RefreshTokenRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/refreshToken.repository.ts, and
 * every method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';

export type FakeRefreshTokenDoc = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
};

export function createFakeRefreshTokenRepository() {
  const store = new Map<string, FakeRefreshTokenDoc>();

  const now = () => Math.floor(Date.now() / 1000);

  const repository = {
    store,

    create: mock(async (userId: string, tokenHash: string, expiresAt: number) => {
      const timestamp = now();
      const doc: FakeRefreshTokenDoc = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        tokenHash,
        expiresAt,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      store.set(doc._id.toString(), doc);

      return doc;
    }),

    // The real repository returns null when nothing matches — it never throws here.
    findByTokenHash: mock(async (tokenHash: string) => {
      return Array.from(store.values()).find((doc) => doc.tokenHash === tokenHash) ?? null;
    }),

    findByUserId: mock(async (userId: string | Types.ObjectId) => {
      return Array.from(store.values()).filter((doc) => String(doc.userId) === String(userId));
    }),

    deleteTokens: mock(async (userId: string | Types.ObjectId, tokenHashes: string[]) => {
      let deletedCount = 0;

      for (const [id, doc] of store) {
        if (String(doc.userId) === String(userId) && tokenHashes.includes(doc.tokenHash)) {
          store.delete(id);
          deletedCount += 1;
        }
      }

      return deletedCount;
    }),
  };

  return repository;
}

export type FakeRefreshTokenRepository = ReturnType<typeof createFakeRefreshTokenRepository>;
