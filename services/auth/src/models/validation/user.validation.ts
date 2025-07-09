import { t } from "elysia";

/*
 * Base model schema
 */
export const userSchema = t.Object({
  userId: t.String(),
  wallet: t.String({ minLength: 1 }),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

/*
 * Authenticate
 */
export const authenticateRequest = t.Object({
  wallet: t.String({ minLength: 1 }),
  signature: t.String({ minLength: 1 }),
  timestamp: t.Number(),
});

export const authenticateResponse = t.Object({
  userId: t.String(),
  wallet: t.String(),
  accessToken: t.String(),
  refreshToken: t.String(),
});

/*
 * Refresh token
 */
export const refreshTokenRequest = t.Object({
  refreshToken: t.String({ minLength: 1 }),
});

export const refreshTokenResponse = t.Object({
  userId: t.String(),
  wallet: t.String(),
  accessToken: t.String(),
  refreshToken: t.String(),
});

/*
 * Get user
 */
export const getUserRequest = t.Object({
  userId: t.String({ minLength: 1 }),
});

export const getUserResponse = userSchema;

/*
 * Get user tokens
 */
export const getUserTokensRequest = t.Object({
  userId: t.String({ minLength: 1 }),
});

export const getUserTokensResponse = t.Array(t.Object({
  tokenId: t.String(),
  userId: t.String(),
  tokenHash: t.String(),
  expiresAt: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
}));

/*
 * Revoke tokens
 */
export const revokeTokensRequest = t.Object({
  userId: t.String({ minLength: 1 }),
  tokenHashes: t.Array(t.String({ minLength: 1 })),
});

export const revokeTokensResponse = t.Object({
  revokedCount: t.Number(),
});
