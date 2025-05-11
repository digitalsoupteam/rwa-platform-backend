import { t } from "elysia";
import { paginationSchema } from "./shared.validation";

/*
 * Entity schema
 */
export const businessSchema = t.Object({
  id: t.String(),
  chainId: t.String(),
  name: t.String(),
  ownerId: t.String(),
  ownerType: t.String(),
  tokenAddress: t.Optional(t.String()),
  description: t.String(),
  tags: t.Array(t.String()),
  riskScore: t.Number(),
  image: t.Optional(t.String()),
  generationCount: t.Number(),
  approvalSignaturesTaskId: t.Optional(t.String()),
  approvalSignaturesTaskExpired: t.Optional(t.Number()),
  paused: t.Boolean(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

/*
 * Create Business
 */
export const createBusinessRequest = t.Composite([
  t.Pick(businessSchema, ["name", "ownerId", "ownerType", "chainId"]),
  t.Partial(t.Pick(businessSchema, ["description", "tags"])),
]);
export const createBusinessResponse = businessSchema;

/*
 * Update Business
 */
export const updateBusinessRequest = t.Object({
  id: t.String(),
  updateData: t.Partial(t.Pick(businessSchema, ["name", "description", "tags", "image"])),
});
export const updateBusinessResponse = businessSchema;

/*
 * Update Risk Score
 */
export const updateBusinessRiskScoreRequest = t.Pick(businessSchema, ["id"]);
export const updateBusinessRiskScoreResponse = businessSchema;

/*
 * Request Approval Signatures
 */
export const requestBusinessApprovalSignaturesRequest = t.Object({
  id: t.String(),
  ownerWallet: t.String(),
  deployerWallet: t.String(),
  createRWAFee: t.String(),
});
export const requestBusinessApprovalSignaturesResponse = t.Object({
  taskId: t.String(),
});

/*
 * Reject Approval Signatures
 */
export const rejectBusinessApprovalSignaturesRequest = t.Pick(businessSchema, ["id"]);
export const rejectBusinessApprovalSignaturesResponse = t.Object({});

/*
 * Get Business
 */
export const getBusinessRequest = t.Pick(businessSchema, ["id"]);
export const getBusinessResponse = businessSchema;

/*
 * Get Businesses
 */
export const getBusinessesRequest = t.Object({
  filter: t.Optional(t.Record(t.String(), t.Any())),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal("asc"), t.Literal("desc")]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number())
});
export const getBusinessesResponse = t.Array(businessSchema);
