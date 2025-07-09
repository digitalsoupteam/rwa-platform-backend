import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getTimelockTasksRequest,
  getTimelockTasksResponse,
} from "../models/validation/dao.validation";

export const getTimelockTasksController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getTimelockTasks",
    async ({ body, daoService }) => {
      logger.info(
        `POST /getTimelockTasks - Getting timelock tasks`
      );
      
      return await daoService.getTimelockTasks(body);
    },
    {
      body: getTimelockTasksRequest,
      response: getTimelockTasksResponse,
    }
  );