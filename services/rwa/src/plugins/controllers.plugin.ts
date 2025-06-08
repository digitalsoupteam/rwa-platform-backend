import { Elysia } from "elysia";

import { createBusinessController } from "../controllers/business/createBusiness.controller";
import { getTokenMetadataController } from "../controllers/token/getTokenMetadata.controller";
import { editBusinessController } from "../controllers/business/editBusiness.controller";
import { updateBusinessRiskScoreController } from "../controllers/business/updateBusinessRiskScore.controller";
import { requestBusinessApprovalSignaturesController } from "../controllers/business/requestBusinessApprovalSignatures.controller";
import { rejectBusinessApprovalSignaturesController } from "../controllers/business/rejectBusinessApprovalSignatures.controller";
import { getBusinessController } from "../controllers/business/getBusiness.controller";
import { getBusinessesController } from "../controllers/business/getBusinesses.controller";

import { createPoolController } from "../controllers/pool/createPool.controller";
import { editPoolController } from "../controllers/pool/editPool.controller";
import { updatePoolRiskScoreController } from "../controllers/pool/updatePoolRiskScore.controller";
import { requestPoolApprovalSignaturesController } from "../controllers/pool/requestPoolApprovalSignatures.controller";
import { rejectPoolApprovalSignaturesController } from "../controllers/pool/rejectPoolApprovalSignatures.controller";
import { getPoolController } from "../controllers/pool/getPool.controller";
import { getPoolsController } from "../controllers/pool/getPools.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  // Business controllers
  .use(createBusinessController)
  .use(editBusinessController)
  .use(updateBusinessRiskScoreController)
  .use(requestBusinessApprovalSignaturesController)
  .use(rejectBusinessApprovalSignaturesController)
  .use(getBusinessController)
  .use(getBusinessesController)
  // Pool controllers
  .use(createPoolController)
  .use(editPoolController)
  .use(updatePoolRiskScoreController)
  .use(requestPoolApprovalSignaturesController)
  .use(rejectPoolApprovalSignaturesController)
  .use(getPoolController)
  .use(getPoolsController)
  // Token controllers
  .use(getTokenMetadataController);