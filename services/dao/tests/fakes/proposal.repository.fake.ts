/**
 * In-memory fake of ProposalRepository for unit tests.
 *
 * The real repository talks to MongoDB. Tests use this fake to keep the
 * service layer isolated: no database, no network, deterministic results.
 * The public API mirrors src/repositories/proposal.repository.ts, and every
 * method is wrapped in bun:test mock() so interactions can be asserted.
 */
import { mock } from 'bun:test';
import { Types } from 'mongoose';

export type FakeProposalDoc = {
  _id: Types.ObjectId;
  proposalId: string;
  proposer: string;
  target: string;
  data: string;
  description: string;
  startTime: number;
  endTime: number;
  state: 'pending' | 'executed' | 'canceled';
  chainId: string;
  transactionHash: string;
  logIndex: number;
  createdAt: number;
  updatedAt: number;
};

export type CreateProposalInput = Omit<FakeProposalDoc, '_id' | 'createdAt' | 'updatedAt' | 'state'>;

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  // Equality matching is enough for the filters used by tests ({ chainId }, { proposalId }, ...).
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeProposalRepository() {
  const store = new Map<string, FakeProposalDoc>();

  const now = () => Math.floor(Date.now() / 1000);

  const repository = {
    store,

    create: mock(async (data: CreateProposalInput) => {
      const timestamp = now();
      const doc: FakeProposalDoc = {
        _id: new Types.ObjectId(),
        state: 'pending', // schema default, same as ProposalEntity
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
      };
      store.set(doc._id.toString(), doc);
      return doc;
    }),

    updateState: mock(async (proposalId: string, state: 'pending' | 'executed' | 'canceled') => {
      // Mirrors findOneAndUpdate without upsert: an unknown proposalId resolves to null.
      const doc = Array.from(store.values()).find((candidate) => candidate.proposalId === proposalId);
      if (!doc) return null;

      const next: FakeProposalDoc = { ...doc, state, updatedAt: now() };
      store.set(doc._id.toString(), next);
      return next;
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

export type FakeProposalRepository = ReturnType<typeof createFakeProposalRepository>;
