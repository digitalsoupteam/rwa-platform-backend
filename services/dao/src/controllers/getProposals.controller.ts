import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getProposalsRequest,
  getProposalsResponse,
} from "../models/validation/dao.validation";

export const getProposalsController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getProposals",
    async ({ body, daoService }) => {
      logger.info(
        `POST /getProposals - Getting proposals`
      );
      
      return await daoService.getProposals(body);
    },
    {
      body: getProposalsRequest,
      response: getProposalsResponse,
    }
  );