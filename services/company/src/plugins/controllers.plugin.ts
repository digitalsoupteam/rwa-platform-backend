import { Elysia } from "elysia";
import { createCompanyController } from "../controllers/company/createCompany.controller";
import { updateCompanyController } from "../controllers/company/updateCompany.controller";
import { deleteCompanyController } from "../controllers/company/deleteCompany.controller";
import { getCompanyController } from "../controllers/company/getCompany.controller";
import { getCompaniesController } from "../controllers/company/getCompanies.controller";
import { addMemberController } from "../controllers/members/addMember.controller";
import { removeMemberController } from "../controllers/members/removeMember.controller";
import { grantPermissionController } from "../controllers/permissions/grantPermission.controller";
import { revokePermissionController } from "../controllers/permissions/revokePermission.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  // Companies controllers
  .use(createCompanyController)
  .use(updateCompanyController)
  .use(deleteCompanyController)
  .use(getCompanyController)
  .use(getCompaniesController)
  // Members controllers
  .use(addMemberController)
  .use(removeMemberController)
  // Permissions controllers
  .use(grantPermissionController)
  .use(revokePermissionController)