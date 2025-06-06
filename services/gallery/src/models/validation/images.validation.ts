import { t } from "elysia";
import { paginationSchema } from "./shared.validation";

/*
 * Entity schemas
 */
export const gallerySchema = t.Object({
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

export const imageSchema = t.Object({
  id: t.String(),
  galleryId: t.String(),
  name: t.String(),
  description: t.String(),
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
 * Create gallery
 */
export const createGalleryRequest = t.Pick(gallerySchema, [
  "name",
  "parentId",
  "ownerId",
  "ownerType",
  "creator",
  "grandParentId",
]);
export const createGalleryResponse = gallerySchema;

/*
 * Update gallery
 */
export const updateGalleryRequest = t.Object({
  id: t.String(),
  updateData: t.Object({
    name: t.String()
  })
});
export const updateGalleryResponse = gallerySchema;

/*
 * Delete gallery
 */
export const deleteGalleryRequest = t.Pick(gallerySchema, ["id"]);
export const deleteGalleryResponse = t.Pick(gallerySchema, ["id"]);

/*
 * Get gallery
 */
export const getGalleryRequest = t.Pick(gallerySchema, ["id"]);
export const getGalleryResponse = gallerySchema;

/*
 * Get galleries by parent ID
 */
export const getGalleriesRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getGalleriesResponse = t.Array(gallerySchema);

/*
 * Create image
 */
export const createImageRequest = t.Pick(imageSchema, [
  "galleryId",
  "name",
  "description",
  "link",
  "ownerId",
  "ownerType",
  "creator",
  "parentId",
  "grandParentId",
]);
export const createImageResponse = imageSchema;

/*
 * Update image
 */
export const updateImageRequest = t.Object({
  id: t.String(),
  updateData: t.Partial(t.Object({
    name: t.String(),
    description: t.String(),
    link: t.String()
  }))
});
export const updateImageResponse = imageSchema;

/*
 * Delete image
 */
export const deleteImageRequest = t.Pick(imageSchema, ["id"]);
export const deleteImageResponse = t.Pick(imageSchema, ["id"]);

/*
 * Get image
 */
export const getImageRequest = t.Pick(imageSchema, ["id"]);
export const getImageResponse = imageSchema;

/*
 * Get images
 */
export const getImagesRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getImagesResponse = t.Array(imageSchema);