import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  getMessageRequest,
  getMessageResponse,
} from "../models/validation/message.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const getMessageController = new Elysia().use(ServicesPlugin).post(
  "/getMessage",
  async ({ body, messageService }) => {
    logger.info(
      `POST /getMessage - Getting message with ID: ${body.id}`
    );

    const message = await messageService.getMessage(body.id);

    return message;
  },
  {
    body: getMessageRequest,
    response: getMessageResponse,
  }
);