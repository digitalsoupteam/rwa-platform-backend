import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { AssistantService } from "../services/assistant.service";
import { MessageService } from "../services/message.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { ClientsPlugin } from "./clients.plugin";
import { CONFIG } from "../config";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .use(ClientsPlugin)

  .decorate("assistantService", {} as AssistantService)
  .decorate("messageService", {} as MessageService)
  .onStart(
    async ({
      decorator
    }) => {
      logger.debug("Initializing services");

      decorator.assistantService = new AssistantService(decorator.assistantRepository);
      decorator.messageService = new MessageService(
        decorator.messageRepository,
        decorator.assistantRepository,
        decorator.openRouterClient,
        CONFIG.OPENROUTER.MODEL
      );
    }
  );
