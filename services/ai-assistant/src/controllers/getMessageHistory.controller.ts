import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  getMessageHistoryRequest,
  getMessageHistoryResponse,
} from "../models/validation/message.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const getMessageHistoryController = new Elysia().use(ServicesPlugin).post(
  "/getMessageHistory",
  async ({ body, messageService }) => {
    logger.info(
      `POST /getMessageHistory - Getting messages for assistant: ${body.assistantId}`
    );

    const messages = await messageService.getMessageHistory(
      body.assistantId,
      body.pagination?.limit,
      body.pagination?.offset
    );

    return messages;
  },
  {
    body: getMessageHistoryRequest,
    response: getMessageHistoryResponse,
  }
);