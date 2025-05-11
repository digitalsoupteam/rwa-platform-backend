import { t } from "elysia";
import { paginationSchema } from "./shared.validation";
import { assistantContextSchema } from "../shared/enums.model";

/*
 * Base model schema
 */
export const assistantSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  name: t.String({ minLength: 1 }),
  contextPreferences: assistantContextSchema,
});

/*
 * Create
 */
export const createAssistantRequest = t.Pick(assistantSchema, [
  "name",
  "type",
  "userId",
  "contextPreferences",
]);

export const createAssistantResponse = assistantSchema;

/*
 * Update
 */
export const updateAssistantRequest = t.Composite([
  t.Pick(assistantSchema, ["id"]),
  t.Partial(t.Pick(assistantSchema, ["name", "contextPreferences"])),
]);

export const updateAssistantResponse = assistantSchema;

/*
 * Delete
 */
export const deleteAssistantRequest = t.Pick(assistantSchema, ["id"]);

export const deleteAssistantResponse = t.Pick(assistantSchema, ["id"]);

/*
 * Get
 */
export const getAssistantRequest = t.Pick(assistantSchema, ["id"]);

export const getAssistantResponse = assistantSchema;

/*
 * Get many
 */
export const getUserAssistantsRequest = t.Object({
  userId: t.String(),
  pagination: t.Optional(paginationSchema),
});

export const getUserAssistantsResponse = t.Array(assistantSchema);
