import { t } from "elysia";
import { paginationSchema } from "./shared.validation";

/*
 * Entity schema
 */
export const poolSchema = t.Object({
  id: t.String(),
  ownerId: t.String(),
  ownerType: t.String(),
  name: t.String(),
  type: t.Union([t.Literal('stable'), t.Literal('speculation')]),
  businessId: t.String(),
  rwaAddress: t.String(),
  poolAddress: t.Optional(t.String()),
  tokenId: t.Optional(t.String()),
  holdToken: t.Optional(t.String()),
  entryFeePercent: t.Optional(t.String()),
  exitFeePercent: t.Optional(t.String()),
  expectedHoldAmount: t.Optional(t.String()),
  expectedRwaAmount: t.Optional(t.String()),
  rewardPercent: t.Optional(t.String()),
  entryPeriodExpired: t.Optional(t.Number()),
  completionPeriodExpired: t.Optional(t.Number()),
  expectedReturnAmount: t.Optional(t.String()),
  accumulatedHoldAmount: t.Optional(t.String()),
  accumulatedRwaAmount: t.Optional(t.String()),
  isTargetReached: t.Optional(t.Boolean()),
  isFullyReturned: t.Optional(t.Boolean()),
  returnedAmount: t.Optional(t.String()),
  paused: t.Optional(t.Boolean()),
  allocatedHoldAmount: t.Optional(t.String()),
  availableReturnBalance: t.Optional(t.String()),
  awaitingRwaAmount: t.Optional(t.String()),
  description: t.Optional(t.String()),
  chainId: t.String(),
  tags: t.Optional(t.Array(t.String())),
  riskScore: t.Optional(t.Number()),
  approvalSignaturesTaskId: t.Optional(t.String()),
  approvalSignaturesTaskExpired: t.Optional(t.Number()),
  entryPeriodDuration: t.Optional(t.Number()),
  completionPeriodDuration: t.Optional(t.Number()),
  stableSpecificFields: t.Optional(t.Object({
    fixedMintPrice: t.Optional(t.String())
  })),
  speculativeSpecificFields: t.Optional(t.Object({
    rwaMultiplierIndex: t.Optional(t.Number()),
    rwaMultiplier: t.Optional(t.Number()),
    realHoldReserve: t.Optional(t.String()),
    virtualHoldReserve: t.Optional(t.String()),
    virtualRwaReserve: t.Optional(t.String()),
    k: t.Optional(t.String()),
    availableBonusAmount: t.Optional(t.String()),
    expectedBonusAmount: t.Optional(t.String())
  })),
  createdAt: t.Number(),
  updatedAt: t.Number()
});

/*
 * Create Pool
 */
export const createPoolRequest = t.Object({
  ownerId: t.String(),
  ownerType: t.String(),
  name: t.String(),
  type: t.Union([t.Literal('stable'), t.Literal('speculation')]),
  chainId: t.String(),
  businessId: t.String(),
  rwaAddress: t.String(),
  expectedHoldAmount: t.Optional(t.String()),
  rewardPercent: t.Optional(t.String()),
  description: t.Optional(t.String()),
  entryPeriodDuration: t.Optional(t.Number()),
  completionPeriodDuration: t.Optional(t.Number()),
  stableSpecificFields: t.Optional(t.Object({})),
  speculativeSpecificFields: t.Optional(t.Object({
    rwaMultiplierIndex: t.Optional(t.Number()),
  }))
});
export const createPoolResponse = poolSchema;

/*
 * Edit Pool
 */
export const editPoolRequest = t.Object({
  id: t.String(),
  updateData: t.Object({
    name: t.Optional(t.String()),
    expectedHoldAmount: t.Optional(t.String()),
    rewardPercent: t.Optional(t.String()),
    description: t.Optional(t.String()),
    tags: t.Optional(t.Array(t.String())),
    riskScore: t.Optional(t.Number()),
    entryPeriodDuration: t.Optional(t.Number()),
    completionPeriodDuration: t.Optional(t.Number()),
    stableSpecificFields: t.Optional(t.Object({})),
    speculativeSpecificFields: t.Optional(t.Object({
      rwaMultiplierIndex: t.Optional(t.Number())
    }))
  })
});
export const editPoolResponse = poolSchema;

/*
 * Update Risk Score
 */
export const updatePoolRiskScoreRequest = t.Pick(poolSchema, ["id"]);
export const updatePoolRiskScoreResponse = poolSchema;

/*
 * Request Approval Signatures
 */
export const requestPoolApprovalSignaturesRequest = t.Object({
  id: t.String(),
  ownerWallet: t.String(),
  deployerWallet: t.String(),
  createPoolFeeRatio: t.String()
});
export const requestPoolApprovalSignaturesResponse = t.Object({
  taskId: t.String()
});

/*
 * Reject Approval Signatures
 */
export const rejectPoolApprovalSignaturesRequest = t.Pick(poolSchema, ["id"]);
export const rejectPoolApprovalSignaturesResponse = t.Object({});

/*
 * Get Pool
 */
export const getPoolRequest = t.Pick(poolSchema, ["id"]);
export const getPoolResponse = poolSchema;

/*
 * Get Pools
 */
export const getPoolsRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getPoolsResponse = t.Array(poolSchema);
