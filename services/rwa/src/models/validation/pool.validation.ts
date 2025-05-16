import { t } from "elysia";
import { paginationSchema } from "./shared.validation";


export const poolSchema = t.Object({
  id: t.String(),
  ownerId: t.String(),
  ownerType: t.String(),
  ownerWallet: t.Optional(t.String()),
  name: t.String(),
  businessId: t.String(),
  description: t.String(),
  chainId: t.String(),
  tags: t.Array(t.String()),
  riskScore: t.Number(),

  // Contract Addresses
  rwaAddress: t.String(),
  poolAddress: t.Optional(t.String()),
  holdToken: t.Optional(t.String()),
  tokenId: t.Optional(t.String()),

  // Pool Configuration
  entryFeePercent: t.Optional(t.String()),
  exitFeePercent: t.Optional(t.String()),
  expectedHoldAmount: t.String(),
  expectedRwaAmount: t.String(),
  expectedBonusAmount: t.String(),
  rewardPercent: t.String(),
  priceImpactPercent: t.String(),
  liquidityCoefficient: t.String(),

  // Pool Flags
  awaitCompletionExpired: t.Boolean(),
  floatingOutTranchesTimestamps: t.Boolean(),
  fixedSell: t.Boolean(),
  allowEntryBurn: t.Boolean(),
  paused: t.Boolean(),

  // Time Periods
  entryPeriodStart: t.Number(),
  entryPeriodExpired: t.Number(),
  completionPeriodExpired: t.Number(),
  floatingTimestampOffset: t.Number(),
  fullReturnTimestamp: t.Optional(t.Number()),

  // Pool State
  k: t.String(),
  realHoldReserve: t.String(),
  virtualHoldReserve: t.String(),
  virtualRwaReserve: t.String(),
  isTargetReached: t.Boolean(),
  isFullyReturned: t.Boolean(),

  // Amounts
  totalClaimedAmount: t.String(),
  totalReturnedAmount: t.String(),
  awaitingBonusAmount: t.String(),
  awaitingRwaAmount: t.String(),
  outgoingTranchesBalance: t.String(),

  // Tranches
  outgoingTranches: t.Array(t.Object({
    amount: t.String(),
    timestamp: t.Number(),
    executedAmount: t.String()
  })),
  incomingTranches: t.Array(t.Object({
    amount: t.String(),
    expiredAt: t.Number(),
    returnedAmount: t.String()
  })),
  lastCompletedIncomingTranche: t.Number(),

  // Approval
  approvalSignaturesTaskId: t.Optional(t.String()),
  approvalSignaturesTaskExpired: t.Optional(t.Number()),

  // Timestamps
  createdAt: t.Number(),
  updatedAt: t.Number()
});

export const createPoolRequest = t.Required(t.Pick(poolSchema, [
  'ownerId',
  'ownerType',
  'name',
  'businessId',
  'chainId',
  'rwaAddress',
]))
export const createPoolResponse = poolSchema;

export const editPoolRequest = t.Object({
  id: t.String(),
  updateData: t.Partial(t.Pick(poolSchema, [
    'name',
    'description',
    'tags',
    'expectedHoldAmount',
    'expectedRwaAmount',
    'rewardPercent',
    'priceImpactPercent',
    'outgoingTranches',
    'incomingTranches',
    'awaitCompletionExpired',
    'floatingOutTranchesTimestamps',
    'fixedSell',
    'allowEntryBurn',
  ]))
});
export const editPoolResponse = poolSchema;

export const updatePoolRiskScoreRequest = t.Pick(poolSchema, ["id"]);
export const updatePoolRiskScoreResponse = poolSchema;

export const requestPoolApprovalSignaturesRequest = t.Object({
  id: t.String(),
  ownerWallet: t.String(),
  deployerWallet: t.String(),
  createPoolFeeRatio: t.String()
});

export const requestPoolApprovalSignaturesResponse = t.Object({
  taskId: t.String()
});

export const rejectPoolApprovalSignaturesRequest = t.Pick(poolSchema, ["id"]);
export const rejectPoolApprovalSignaturesResponse = t.Object({});

export const getPoolRequest = t.Pick(poolSchema, ["id"]);
export const getPoolResponse = poolSchema;

export const getPoolsRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});

export const getPoolsResponse = t.Array(poolSchema);
