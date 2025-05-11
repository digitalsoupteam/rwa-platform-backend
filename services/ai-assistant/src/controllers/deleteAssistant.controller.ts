import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  deleteAssistantRequest,
  deleteAssistantResponse,
} from "../models/validation/assistant.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const deleteAssistantController = new Elysia().use(ServicesPlugin).post(
  "/deleteAssistant",
  async ({ body, assistantService }) => {
    logger.info(
      `POST /deleteAssistant - Deleting assistant with ID: ${body.id}`
    );

    const result = await assistantService.deleteAssistant(body.id);

    return result;
  },
  {
    body: deleteAssistantRequest,
    response: deleteAssistantResponse,
  }
);