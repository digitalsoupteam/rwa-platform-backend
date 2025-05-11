import { t } from "elysia";
import { paginationSchema } from "./shared.validation";

/*
 * Entity schemas
 */
export const tokenBalanceSchema = t.Object({
  id: t.String(),
  owner: t.String(),
  tokenAddress: t.String(),
  chainId: t.String(),
  balance: t.Number(),
  lastUpdateBlock: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const transactionSchema = t.Object({
  id: t.String(),
  from: t.String(),
  to: t.String(),
  tokenAddress: t.String(),
  tokenId: t.String(),
  chainId: t.String(),
  transactionHash: t.String(),
  blockNumber: t.Number(),
  amount: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

/*
 * Get token balances
 */
export const getBalancesRequest = t.Object({
  owners: t.Optional(t.Array(t.String())),
  tokenAddresses: t.Optional(t.Array(t.String())),
  chainIds: t.Optional(t.Array(t.String())),
  pagination: t.Optional(paginationSchema),
});
export const getBalancesResponse = t.Array(tokenBalanceSchema);

/*
 * Get transactions
 */
export const getTransactionsRequest = t.Object({
  from: t.Optional(t.Array(t.String())),
  to: t.Optional(t.Array(t.String())),
  tokenAddresses: t.Optional(t.Array(t.String())),
  chainIds: t.Optional(t.Array(t.String())),
  blockNumbers: t.Optional(t.Array(t.Number())),
  pagination: t.Optional(paginationSchema),
});
export const getTransactionsResponse = t.Array(transactionSchema);
