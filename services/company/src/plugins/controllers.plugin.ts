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
import { ServicesPlugin } from "./services.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const createCompanyCtrl = withTraceSync(
    'company.init.controllers.create_company',
    () => createCompanyController(servicesPlugin)
  );

  const updateCompanyCtrl = withTraceSync(
    'company.init.controllers.update_company',
    () => updateCompanyController(servicesPlugin)
  );

  const deleteCompanyCtrl = withTraceSync(
    'company.init.controllers.delete_company',
    () => deleteCompanyController(servicesPlugin)
  );

  const getCompanyCtrl = withTraceSync(
    'company.init.controllers.get_company',
    () => getCompanyController(servicesPlugin)
  );

  const getCompaniesCtrl = withTraceSync(
    'company.init.controllers.get_companies',
    () => getCompaniesController(servicesPlugin)
  );

  const addMemberCtrl = withTraceSync(
    'company.init.controllers.add_member',
    () => addMemberController(servicesPlugin)
  );

  const removeMemberCtrl = withTraceSync(
    'company.init.controllers.remove_member',
    () => removeMemberController(servicesPlugin)
  );

  const grantPermissionCtrl = withTraceSync(
    'company.init.controllers.grant_permission',
    () => grantPermissionController(servicesPlugin)
  );

  const revokePermissionCtrl = withTraceSync(
    'company.init.controllers.revoke_permission',
    () => revokePermissionController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'company.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(createCompanyCtrl)
      .use(updateCompanyCtrl)
      .use(deleteCompanyCtrl)
      .use(getCompanyCtrl)
      .use(getCompaniesCtrl)
      .use(addMemberCtrl)
      .use(removeMemberCtrl)
      .use(grantPermissionCtrl)
      .use(revokePermissionCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>