import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  createMessageRequest,
  createMessageResponse,
} from "../models/validation/message.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const createMessageController = new Elysia().use(ServicesPlugin).post(
  "/createMessage",
  async ({ body, messageService }) => {
    logger.info(
      `POST /createMessage - Creating message for assistant: ${body.assistantId}`
    );

    const result = await messageService.createMessage({
      assistantId: body.assistantId,
      text: body.text,
    });

    return result;
  },
  {
    body: createMessageRequest,
    response: createMessageResponse,
  }
);