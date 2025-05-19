import { t } from "elysia";

/*
 * Base model schema
 */
export const fileSchema = t.Object({
  id: t.String(),
  name: t.String({ minLength: 1 }),
  path: t.String(),
  size: t.Number(),
  mimeType: t.String(),
});

/*
 * File upload schema
 */
export const createFileRequest = t.Object({
  file: t.File()
});

export const createFileResponse = fileSchema;

/*
 * Update
 */
export const updateFileRequest = t.Composite([
  t.Pick(fileSchema, ["id"]),
  t.Partial(t.Pick(fileSchema, ["name"])),
]);

export const updateFileResponse = fileSchema;

/*
 * Delete
 */
export const deleteFileRequest = t.Pick(fileSchema, ["id"]);

export const deleteFileResponse = t.Pick(fileSchema, ["id"]);

/*
 * Get
 */
export const getFileRequest = t.Pick(fileSchema, ["id"]);

export const getFileResponse = fileSchema;
