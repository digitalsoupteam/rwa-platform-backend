import { Elysia } from "elysia";
import { getFeesController } from "../controllers/getFees.controller";
import { getReferralsController } from "../controllers/getReferrals.controller";
import { registerReferralController } from "../controllers/registerReferral.controller";
import { getReferrerWithdrawsController } from "../controllers/getReferrerWithdraws.controller";
import { getReferrerClaimHistoryController } from "../controllers/getReferrerClaimHistory.controller";
import { createReferrerWithdrawTaskController } from "../controllers/createReferrerWithdrawTask.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(getFeesController)
  .use(getReferralsController)
  .use(registerReferralController)
  .use(getReferrerWithdrawsController)
  .use(getReferrerClaimHistoryController)
  .use(createReferrerWithdrawTaskController);