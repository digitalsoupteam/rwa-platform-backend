import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  updateAssistantRequest,
  updateAssistantResponse,
} from "../models/validation/assistant.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const updateAssistantController = new Elysia().use(ServicesPlugin).post(
  "/updateAssistant",
  async ({ body, assistantService }) => {
    logger.info(
      `POST /updateAssistant - Updating assistant with ID: ${body.id}`
    );

    const assistant = await assistantService.updateAssistant(body.id, {
      name: body.name,
      contextPreferences: body.contextPreferences,
    });

    return assistant;
  },
  {
    body: updateAssistantRequest,
    response: updateAssistantResponse,
  }
);
