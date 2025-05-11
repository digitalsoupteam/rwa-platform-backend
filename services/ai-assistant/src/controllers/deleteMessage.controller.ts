import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  deleteMessageRequest,
  deleteMessageResponse,
} from "../models/validation/message.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const deleteMessageController = new Elysia().use(ServicesPlugin).post(
  "/deleteMessage",
  async ({ body, messageService }) => {
    logger.info(
      `POST /deleteMessage - Deleting message with ID: ${body.id}`
    );

    const id = await messageService.deleteMessage(body.id);

    return { id };
  },
  {
    body: deleteMessageRequest,
    response: deleteMessageResponse,
  }
);