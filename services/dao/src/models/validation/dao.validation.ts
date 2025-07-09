import { t } from "elysia";

/*
 * Entity schemas
 */
export const proposalSchema = t.Object({
  id: t.String(),
  proposalId: t.String(),
  proposer: t.String(),
  target: t.String(),
  data: t.String(),
  description: t.String(),
  startTime: t.Number(),
  endTime: t.Number(),
  state: t.String(),
  chainId: t.String(),
  transactionHash: t.String(),
  logIndex: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const voteSchema = t.Object({
  id: t.String(),
  proposalId: t.String(),
  chainId: t.String(),
  governanceAddress: t.String(),
  voterWallet: t.String(),
  support: t.Boolean(),
  weight: t.String(),
  reason: t.String(),
  transactionHash: t.String(),
  logIndex: t.Number(),
  blockNumber: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const stakingHistorySchema = t.Object({
  id: t.String(),
  staker: t.String(),
  amount: t.String(),
  operation: t.String(),
  chainId: t.String(),
  transactionHash: t.String(),
  logIndex: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const timelockTaskSchema = t.Object({
  id: t.String(),
  txHash: t.String(),
  target: t.String(),
  data: t.String(),
  eta: t.Number(),
  executed: t.Boolean(),
  chainId: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const treasuryWithdrawSchema = t.Object({
  id: t.String(),
  recipient: t.String(),
  token: t.String(),
  amount: t.String(),
  chainId: t.String(),
  transactionHash: t.String(),
  logIndex: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const stakingSchema = t.Object({
  id: t.String(),
  staker: t.String(),
  amount: t.String(),
  lastStakeTimestamp: t.Number(),
  chainId: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

/*
 * Get proposals
 */
export const getProposalsRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getProposalsResponse = t.Array(proposalSchema);

/*
 * Get votes for proposal
 */
export const getVotesRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getVotesResponse = t.Array(voteSchema);

/*
 * Get user staking history
 */
export const getStakingHistoryRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getStakingHistoryResponse = t.Array(stakingHistorySchema);

/*
 * Get pending timelock tasks
 */
export const getTimelockTasksRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getTimelockTasksResponse = t.Array(timelockTaskSchema);

/*
 * Get treasury withdrawals
 */
export const getTreasuryWithdrawalsRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getTreasuryWithdrawalsResponse = t.Array(treasuryWithdrawSchema);

/*
 * Get staking records
 */
export const getStakingRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getStakingResponse = t.Array(stakingSchema);