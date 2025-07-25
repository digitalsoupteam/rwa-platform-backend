import { t } from "elysia";
import { paginationSchema } from "./shared.validation";
import { faucetTokenTypeSchema } from "../shared/enums.model";

/*
 * Base model schema
 */
export const faucetRequestSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  wallet: t.String(),
  tokenType: faucetTokenTypeSchema,
  amount: t.Number(),
  transactionHash: t.String(),
  createdAt: t.Number()
});

/*
 * Request gas
 */
export const requestGasSchema = t.Object({
  userId: t.String(),
  wallet: t.String(),
  amount: t.Number()
});

export const requestGasResponse = faucetRequestSchema;

/*
 * Request hold
 */
export const requestHoldSchema = t.Object({
  userId: t.String(),
  wallet: t.String(),
  amount: t.Number()
});

export const requestHoldResponse = faucetRequestSchema;

/*
 * Request platform
 */
export const requestPlatformSchema = t.Object({
  userId: t.String(),
  wallet: t.String(),
  amount: t.Number()
});

export const requestPlatformResponse = faucetRequestSchema;

/*
 * Get history
 */
export const getHistorySchema = t.Object({
  userId: t.String(),
  pagination: t.Optional(paginationSchema)
});

export const getHistoryResponse = t.Array(faucetRequestSchema);

/*
 * Get unlock time
 */
export const getUnlockTimeSchema = t.Object({
  userId: t.String()
});

export const getUnlockTimeResponse = t.Object({
  gasUnlockTime: t.Number(),
  holdUnlockTime: t.Number()
});