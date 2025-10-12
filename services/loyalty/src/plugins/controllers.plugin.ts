import { Elysia } from "elysia";
import { getFeesController } from "../controllers/getFees.controller";
import { getReferralsController } from "../controllers/getReferrals.controller";
import { registerReferralController } from "../controllers/registerReferral.controller";
import { getReferrerWithdrawsController } from "../controllers/getReferrerWithdraws.controller";
import { getReferrerClaimHistoryController } from "../controllers/getReferrerClaimHistory.controller";
import { getCommissionHistoryController } from "../controllers/getCommissionHistory.controller";
import { createReferrerWithdrawTaskController } from "../controllers/createReferrerWithdrawTask.controller";
import type { ServicesPlugin } from "./services.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const getFeesCtrl = withTraceSync(
    'loyalty.init.controllers.get_fees',
    () => getFeesController(servicesPlugin)
  );

  const getReferralsCtrl = withTraceSync(
    'loyalty.init.controllers.get_referrals',
    () => getReferralsController(servicesPlugin)
  );

  const registerReferralCtrl = withTraceSync(
    'loyalty.init.controllers.register_referral',
    () => registerReferralController(servicesPlugin)
  );

  const getReferrerWithdrawsCtrl = withTraceSync(
    'loyalty.init.controllers.get_referrer_withdraws',
    () => getReferrerWithdrawsController(servicesPlugin)
  );

  const getReferrerClaimHistoryCtrl = withTraceSync(
    'loyalty.init.controllers.get_referrer_claim_history',
    () => getReferrerClaimHistoryController(servicesPlugin)
  );

  const getCommissionHistoryCtrl = withTraceSync(
    'loyalty.init.controllers.get_commission_history',
    () => getCommissionHistoryController(servicesPlugin)
  );

  const createReferrerWithdrawTaskCtrl = withTraceSync(
    'loyalty.init.controllers.create_referrer_withdraw_task',
    () => createReferrerWithdrawTaskController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'loyalty.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(getFeesCtrl)
      .use(getReferralsCtrl)
      .use(registerReferralCtrl)
      .use(getReferrerWithdrawsCtrl)
      .use(getReferrerClaimHistoryCtrl)
      .use(getCommissionHistoryCtrl)
      .use(createReferrerWithdrawTaskCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>