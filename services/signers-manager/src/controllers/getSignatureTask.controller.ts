import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  getSignatureTaskRequest,
  getSignatureTaskResponse,
} from "../models/validation/signature.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const getSignatureTaskController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getSignatureTask",
    async ({ body, signaturesService }) => {
      logger.info(
        `POST /getSignatureTask - Getting signature task: ${body.taskId}`
      );

      const result = await signaturesService.getSignatureTask(body.taskId);

      return result;
    },
    {
      body: getSignatureTaskRequest,
      response: getSignatureTaskResponse,
    }
  );