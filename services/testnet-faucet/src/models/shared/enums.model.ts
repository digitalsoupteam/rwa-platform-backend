import { t } from "elysia";

/*
 * Faucet token type enum
 */
export const FaucetTokenTypeList = [
  "gas",
  "hold"
] as const;

export const faucetTokenTypeSchema = t.Union([
  t.Literal("gas"),
  t.Literal("hold")
]);

export type FaucetTokenType = typeof faucetTokenTypeSchema.static;