import { t } from "elysia";

/*
 * Entity schemas
 */
export const productOwnerMetricsSchema = t.Object({
  id: t.String(),
  userWallet: t.String(),
  chainId: t.Number(),
  businessesCreated: t.Number(),
  poolsCreated: t.Number(),
  businessesDeployed: t.Number(),
  poolsDeployed: t.Number(),
  targetReachedPools: t.Number(),
  fullyReturnedPools: t.Number(),
  poolsReturnCalled: t.Number(),
  poolsFullyReturnCalled: t.Number(),
  incomingTranchesCount: t.Number(),
  outgoingTranchesCount: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const productOwnerTokenMetricsSchema = t.Object({
  id: t.String(),
  userWallet: t.String(),
  chainId: t.Number(),
  holdTokenAddress: t.String(),
  ownerTotalFundsReturned: t.String(),
  managerTotalFundsReturned: t.String(),
  totalFundsWithdrawn: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const userPoolActivitySchema = t.Object({
  id: t.String(),
  userWallet: t.String(),
  chainId: t.Number(),
  poolId: t.String(),
  businessId: t.String(),
  earlyMintCount: t.Number(),
  earlyBurnCount: t.Number(),
  middleMintCount: t.Number(),
  middleBurnCount: t.Number(),
  lateMintCount: t.Number(),
  lateBurnCount: t.Number(),
  postMintCount: t.Number(),
  postBurnCount: t.Number(),
  targetsReachedCount: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const userPoolTokenActivitySchema = t.Object({
  id: t.String(),
  userWallet: t.String(),
  chainId: t.Number(),
  poolId: t.String(),
  businessId: t.String(),
  holdTokenAddress: t.String(),
  earlyMintVolume: t.String(),
  earlyBurnVolume: t.String(),
  middleMintVolume: t.String(),
  middleBurnVolume: t.String(),
  lateMintVolume: t.String(),
  lateBurnVolume: t.String(),
  postMintVolume: t.String(),
  postBurnVolume: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

/*
 * Get product owner metrics
 */
export const getProductOwnerMetricsRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getProductOwnerMetricsResponse = t.Array(productOwnerMetricsSchema);

/*
 * Get product owner token metrics
 */
export const getProductOwnerTokenMetricsRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getProductOwnerTokenMetricsResponse = t.Array(productOwnerTokenMetricsSchema);

/*
 * Get user pool activities
 */
export const getUserPoolActivitiesRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getUserPoolActivitiesResponse = t.Array(userPoolActivitySchema);

/*
 * Get user pool token activities
 */
export const getUserPoolTokenActivitiesRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getUserPoolTokenActivitiesResponse = t.Array(userPoolTokenActivitySchema);