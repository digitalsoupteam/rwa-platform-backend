import { t } from "elysia";

/*
 * Faucet token type enum
 */
export const FaucetTokenTypeList = [
  "gas",
  "hold",
  "platform"
] as const;

export const faucetTokenTypeSchema = t.Union([
  t.Literal("gas"),
  t.Literal("hold"),
  t.Literal("platform")
]);

export type FaucetTokenType = typeof faucetTokenTypeSchema.static;