import { t } from "elysia";
import { paginationSchema } from "./shared.validation";

/*
 * Entity schemas
 */
export const companySchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
  ownerId: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const memberSchema = t.Object({
  id: t.String(),
  companyId: t.String(),
  userId: t.String(),
  name: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export const permissionSchema = t.Object({
  id: t.String(),
  companyId: t.String(),
  userId: t.String(),
  permission: t.String(),
  entity: t.Optional(t.String()),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

// Company with details schema
export const companyWithDetailsSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
  ownerId: t.String(),
  users: t.Array(t.Object({
    id: t.String(),
    userId: t.String(),
    name: t.String(),
    permissions: t.Array(t.Object({
      id: t.String(),
      permission: t.String(),
      entity: t.Optional(t.String()),
    })),
  })),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

/*
 * Create company
 */
export const createCompanyRequest = t.Pick(companySchema, [
  "name",
  "description",
  "ownerId",
]);
export const createCompanyResponse = companySchema;

/*
 * Update company
 */
export const updateCompanyRequest = t.Object({
  id: t.String(),
  updateData: t.Object({
    name: t.Optional(t.String()),
    description: t.Optional(t.String())
  })
});
export const updateCompanyResponse = companySchema;

/*
 * Delete company
 */
export const deleteCompanyRequest = t.Pick(companySchema, ["id"]);
export const deleteCompanyResponse = t.Pick(companySchema, ["id"]);

/*
 * Get company
 */
export const getCompanyRequest = t.Pick(companySchema, ["id"]);
export const getCompanyResponse = companyWithDetailsSchema;

/*
 * Get companies
 */
export const getCompaniesRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal('asc'), t.Literal('desc')]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number()),
});
export const getCompaniesResponse = t.Array(companySchema);

/*
 * Add member
 */
export const addMemberRequest = t.Pick(memberSchema, [
  "companyId",
  "userId",
  "name",
]);
export const addMemberResponse = memberSchema;

/*
 * Remove member
 */
export const removeMemberRequest = t.Pick(memberSchema, ["id"]);
export const removeMemberResponse = t.Pick(memberSchema, ["id"]);

/*
 * Grant permission
 */
export const grantPermissionRequest = t.Object({
  companyId: t.String(),
  memberId: t.String(),
  userId: t.String(),
  permission: t.String(),
  entity: t.String(),
});
export const grantPermissionResponse = permissionSchema;

/*
 * Revoke permission
 */
export const revokePermissionRequest = t.Pick(permissionSchema, ["id"]);
export const revokePermissionResponse = t.Pick(permissionSchema, ["id"]);