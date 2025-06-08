import { t } from "elysia";

const businessPropertiesSchema = t.Object({
  id: t.String(),
  name: t.String(),
  riskScore: t.Number()
});

const poolPropertiesSchema = t.Object({
  address: t.Optional(t.String()),
  holdToken: t.Optional(t.String()),
  expectedHoldAmount: t.Optional(t.String()),
  expectedRwaAmount: t.Optional(t.String()),
  rewardPercent: t.Optional(t.String()),
  entryFeePercent: t.Optional(t.String()),
  exitFeePercent: t.Optional(t.String())
});

const statusPropertiesSchema = t.Object({
  isTargetReached: t.Boolean(),
  isFullyReturned: t.Boolean(),
  paused: t.Boolean()
});

export const tokenMetadataSchema = t.Object({
  name: t.String(),
  description: t.String(),
  image: t.String(),
  decimals: t.Number(),
  properties: t.Object({
    business: businessPropertiesSchema,
    pool: poolPropertiesSchema,
    status: statusPropertiesSchema,
    tags: t.Array(t.String())
  })
});

export const getTokenMetadataRequest = t.Object({
  tokenId: t.String()
});

export const getTokenMetadataResponse = tokenMetadataSchema;