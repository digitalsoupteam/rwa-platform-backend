import { t } from "elysia";

/*
 * Entity schemas
 */
export const feesSchema = t.Object({
  id: t.String(),
  userWallet: t.String(),
  userId: t.String(),
  chainId: t.String(),
  tokenAddress: t.String(),
  buyCommissionAmount: t.String(),
  sellCommissionAmount: t.String(),
  tokenCreationCommissionAmount: t.String(),
  poolCreationCommissionAmount: t.String(),
  referralRewardAmount: t.String(),
  buyCommissionCount: t.Number(),
  sellCommissionCount: t.Number(),
  tokenCreationCommissionCount: t.Number(),
  poolCreationCommissionCount: t.Number(),
  referralRewardCount: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const referralSchema = t.Object({
  id: t.String(),
  userWallet: t.String(),
  userId: t.String(),
  referrerWallet: t.Optional(t.String()),
  referrerId: t.Optional(t.String()),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const referrerWithdrawSchema = t.Object({
  id: t.String(),
  referrerWallet: t.String(),
  referrerId: t.String(),
  chainId: t.String(),
  tokenAddress: t.String(),
  totalWithdrawnAmount: t.String(),
  taskId: t.Optional(t.String()),
  taskExpiredAt: t.Optional(t.Number()),
  taskCooldown: t.Optional(t.Number()),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const referrerClaimHistorySchema = t.Object({
  id: t.String(),
  referrerWallet: t.String(),
  referrerId: t.String(),
  referralWallet: t.String(),
  chainId: t.String(),
  tokenAddress: t.String(),
  amount: t.String(),
  transactionHash: t.String(),
  logIndex: t.Number(),
  blockNumber: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

/*
 * Get fees
 */
export const getFeesRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getFeesResponse = t.Array(feesSchema);

/*
 * Get referrals
 */
export const getReferralsRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getReferralsResponse = t.Array(referralSchema);

/*
 * Register referral
 */
export const registerReferralRequest = t.Object({
  userWallet: t.String({pattern: "^0x[a-f0-9]{40}$"}),
  userId: t.String(),
  referrerWallet: t.Optional(t.String({pattern: "^0x[a-f0-9]{40}$"})),
  referrerId: t.Optional(t.String()),
});
export const registerReferralResponse = referralSchema;

/*
 * Get referrer withdraws
 */
export const getReferrerWithdrawsRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getReferrerWithdrawsResponse = t.Array(referrerWithdrawSchema);

/*
 * Get referrer claim history
 */
export const getReferrerClaimHistoryRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getReferrerClaimHistoryResponse = t.Array(referrerClaimHistorySchema);

/*
 * Request claim signatures
 */
export const createReferrerWithdrawTaskRequest = t.Object({
  referrerWallet: t.String({pattern: "^0x[a-f0-9]{40}$"}),
  referrerId: t.String(),
  chainId: t.String(),
  tokenAddress: t.String(),
  amount: t.String(),
});
export const createReferrerWithdrawTaskResponse = referrerWithdrawSchema;