import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  createAssistantRequest,
  createAssistantResponse,
} from "../models/validation/assistant.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const createAssistantController = new Elysia().use(ServicesPlugin).post(
  "/createAssistant",
  async ({ body, assistantService }) => {
    logger.info(
      `POST /createAssistant - Creating new assistant with name: ${body.name}`
    );

    const assistant = await assistantService.createAssistant({
      name: body.name,
      userId: body.userId,
      contextPreferences: body.contextPreferences,
    });

    return assistant;
  },
  {
    body: createAssistantRequest,
    response: createAssistantResponse,
  }
);
