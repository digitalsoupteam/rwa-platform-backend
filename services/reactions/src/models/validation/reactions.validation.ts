import { t } from "elysia";

/*
 * Entity schemas
 */
export const reactionSchema = t.Object({
  id: t.String(),
  parentId: t.String(),
  parentType: t.String(),
  userId: t.String(),
  reaction: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

/*
 * Toggle reaction
 */
export const toggleReactionRequest = t.Pick(reactionSchema, [
  "parentId",
  "parentType",
  "userId",
  "reaction"
]);
export const toggleReactionResponse = t.Optional(reactionSchema);

/*
 * Get reactions
 */
export const getReactionsRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getReactionsResponse = t.Array(reactionSchema);