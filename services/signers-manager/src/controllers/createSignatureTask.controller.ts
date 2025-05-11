import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  createSignatureTaskRequest,
  createSignatureTaskResponse,
} from "../models/validation/signature.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const createSignatureTaskController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createSignatureTask",
    async ({ body, signaturesService }) => {
      logger.info(
        `POST /createSignatureTask - Creating new signature task with hash: ${body.hash}`
      );

      const task = await signaturesService.createTask(body);

      return task;
    },
    {
      body: createSignatureTaskRequest,
      response: createSignatureTaskResponse,
    }
  );