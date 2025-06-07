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
 * Set reaction
 */
export const setReactionRequest = t.Pick(reactionSchema, [
  "parentId",
  "parentType",
  "userId",
  "reaction"
]);
export const setReactionResponse = reactionSchema;

/*
 * Reset reaction
 */
export const resetReactionRequest = t.Pick(reactionSchema, [
  "parentId",
  "parentType",
  "userId",
  "reaction"
]);
export const resetReactionResponse = reactionSchema;

/*
 * Get entity reactions
 */
export const getEntityReactionsRequest = t.Object({
  parentId: t.String(),
  parentType: t.String(),
  userId: t.Optional(t.String())
});

export const getEntityReactionsResponse = t.Object({
  reactions: t.Record(t.String(), t.Number()),
  userReactions: t.Array(t.String())
});