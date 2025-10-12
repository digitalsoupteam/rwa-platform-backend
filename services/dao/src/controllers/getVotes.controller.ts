import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getVotesRequest,
  getVotesResponse,
} from "../models/validation/dao.validation";

export const getVotesController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetVotesController" })
    .use(servicesPlugin)
    .post(
      "/getVotes",
      async ({ body, daoService }) => {
        logger.info(
          `POST /getVotes - Getting votes`
        );

        return await daoService.getVotes(body);
      },
      {
        body: getVotesRequest,
        response: getVotesResponse,
      }
    );
};