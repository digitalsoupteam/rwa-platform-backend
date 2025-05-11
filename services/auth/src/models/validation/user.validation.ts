import { t } from "elysia";

/*
 * Base model schema
 */
export const userSchema = t.Object({
  userId: t.String(),
  wallet: t.String({ minLength: 1 }),
  nonce: t.String(),
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

export const getUserResponse = t.Object({
  userId: t.String(),
  wallet: t.String(),
});
