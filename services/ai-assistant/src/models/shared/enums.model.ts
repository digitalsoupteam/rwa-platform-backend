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
] as const;

export const assistantContextSchema = t.Array(
  t.Union([
    // Assistant types
    t.Literal("investor_base"),
    t.Literal("product_owner_base"),
    // Context data
    t.Literal("popular_pools"),
    t.Literal("user_portfolio"),
  ])
);

export type AssistantContext = typeof assistantContextSchema.static;