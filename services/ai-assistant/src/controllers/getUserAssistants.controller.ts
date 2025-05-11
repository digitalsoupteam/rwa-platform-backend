import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  getUserAssistantsRequest,
  getUserAssistantsResponse,
} from "../models/validation/assistant.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const getUserAssistantsController = new Elysia().use(ServicesPlugin).post(
  "/getUserAssistants",
  async ({ body, assistantService }) => {
    logger.info(
      `POST /getUserAssistants - Getting assistants for user: ${body.userId}`
    );

    const assistants = await assistantService.getUserAssistants(body.userId);

    return assistants;
  },
  {
    body: getUserAssistantsRequest,
    response: getUserAssistantsResponse,
  }
);