import { Elysia } from "elysia";
import type { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updatePoolRiskScoreRequest,
  updatePoolRiskScoreResponse,
} from "../../models/validation/pool.validation";

export const updatePoolRiskScoreController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "UpdatePoolRiskScoreController" })
    .use(servicesPlugin)
    .post(
      "/updatePoolRiskScore",
      async ({ body, poolService }) => {

        return await poolService.updateRiskScore(body.id);
      },
      {
        body: updatePoolRiskScoreRequest,
        response: updatePoolRiskScoreResponse,
      }
    );
};