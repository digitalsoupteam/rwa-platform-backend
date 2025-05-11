import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  getAssistantRequest,
  getAssistantResponse,
} from "../models/validation/assistant.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const getAssistantController = new Elysia().use(ServicesPlugin).post(
  "/getAssistant",
  async ({ body, assistantService }) => {
    logger.info(
      `POST /getAssistant - Getting assistant with ID: ${body.id}`
    );

    const assistant = await assistantService.getAssistant(body.id);

    return assistant;
  },
  {
    body: getAssistantRequest,
    response: getAssistantResponse,
  }
);