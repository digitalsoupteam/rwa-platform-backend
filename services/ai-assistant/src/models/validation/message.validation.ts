import { t } from "elysia";
import { assistantSchema } from "./assistant.validation";
import { paginationSchema } from "./shared.validation";

/*
 * Base model schema
 */
export const messageSchema = t.Object({
  id: t.String(),
  assistantId: assistantSchema.properties.id,
  text: t.String(),
});

/*
 * Create
 */
export const createMessageRequest = t.Pick(messageSchema, [
  "assistantId",
  "text",
]);

export const createMessageResponse = t.Array(messageSchema);

/*
 * Get
 */
export const getMessageRequest = t.Pick(messageSchema, ["id"]);

export const getMessageResponse = messageSchema;

/*
 * Get many
 */
export const getMessageHistoryRequest = t.Object({
  assistantId: assistantSchema.properties.id,
  pagination: t.Optional(paginationSchema),
});

export const getMessageHistoryResponse = t.Array(messageSchema);

/*
 * Update
 */
export const updateMessageRequest = t.Pick(messageSchema, [
  "id",
  "text",
]);

export const updateMessageResponse = messageSchema;

/*
 * Delete
 */
export const deleteMessageRequest = t.Pick(messageSchema, ["id"]);

export const deleteMessageResponse = t.Pick(messageSchema, ["id"]);
