import { t } from "elysia";

/*
 * Assistant type enum
 */
export const AssistantContextList = [
  // Assistant types
  "investor_base",
  "product_owner_base",
  // Context data
  "popular_pools",
  "user_portfolio",
  "user_balance",
  "market_data",
] as const;

export const assistantContextSchema = t.Array(
  t.Union([
    // Assistant types
    t.Literal("investor_base"),
    t.Literal("product_owner_base"),
    // Context data
    t.Literal("popular_pools"),
    t.Literal("user_portfolio"),
    t.Literal("user_balance"),
    t.Literal("market_data"),
  ])
);

export type AssistantContext = typeof assistantContextSchema.static;