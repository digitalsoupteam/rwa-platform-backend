import { t } from "elysia";
import { paginationSchema } from "./shared.validation";

/*
 * Entity schemas
 */
export const documentsFolderSchema = t.Object({
  id: t.String(),
  name: t.String(),
  parentId: t.String(),
  ownerId: t.String(),
  ownerType: t.String(),
  creator: t.String(),
  grandParentId: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const documentSchema = t.Object({
  id: t.String(),
  folderId: t.String(),
  name: t.String(),
  link: t.String(),
  ownerId: t.String(),
  ownerType: t.String(),
  creator: t.String(),
  parentId: t.String(),
  grandParentId: t.String(),
    createdAt: t.Number(),
    updatedAt: t.Number(),
});

/*
 * Create folder
 */
export const createFolderRequest = t.Pick(documentsFolderSchema, [
  "name",
  "parentId",
  "ownerId",
  "ownerType",
  "creator",
  "grandParentId",
]);
export const createFolderResponse = documentsFolderSchema;

/*
 * Update folder
 */
export const updateFolderRequest = t.Object({
  id: t.String(),
  updateData: t.Object({
    name: t.String()
  })
});
export const updateFolderResponse = documentsFolderSchema;

/*
 * Delete folder
 */
export const deleteFolderRequest = t.Pick(documentsFolderSchema, ["id"]);
export const deleteFolderResponse = t.Pick(documentsFolderSchema, ["id"]);

/*
 * Get folder
 */
export const getFolderRequest = t.Pick(documentsFolderSchema, ["id"]);
export const getFolderResponse = documentsFolderSchema;

/*
 * Get folders
 */
export const getFoldersRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getFoldersResponse = t.Array(documentsFolderSchema);

/*
 * Create document
 */
export const createDocumentRequest = t.Pick(documentSchema, [
  "folderId",
  "name",
  "link",
  "ownerId",
  "ownerType",
  "creator",
  "parentId",
  "grandParentId",
]);
export const createDocumentResponse = documentSchema;

/*
 * Update document
 */
export const updateDocumentRequest = t.Object({
  id: t.String(),
  updateData: t.Partial(t.Object({
    name: t.String(),
    link: t.String()
  }))
});
export const updateDocumentResponse = documentSchema;

/*
 * Delete document
 */
export const deleteDocumentRequest = t.Pick(documentSchema, ["id"]);
export const deleteDocumentResponse = t.Pick(documentSchema, ["id"]);

/*
 * Get document
 */
export const getDocumentRequest = t.Pick(documentSchema, ["id"]);
export const getDocumentResponse = documentSchema;

/*
 * Get documents
 */
export const getDocumentsRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getDocumentsResponse = t.Array(documentSchema);