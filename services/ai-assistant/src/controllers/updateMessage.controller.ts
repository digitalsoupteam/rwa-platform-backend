import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  updateMessageRequest,
  updateMessageResponse,
} from "../models/validation/message.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const updateMessageController = new Elysia().use(ServicesPlugin).post(
  "/updateMessage",
  async ({ body, messageService }) => {
    logger.info(
      `POST /updateMessage - Updating message with ID: ${body.id}`
    );

    const message = await messageService.updateMessage(body.id, {
      text: body.text,
    });

    return message;
  },
  {
    body: updateMessageRequest,
    response: updateMessageResponse,
  }
);