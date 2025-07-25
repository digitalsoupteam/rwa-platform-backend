import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { AssistantService } from "../services/assistant.service";
import { MessageService } from "../services/message.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { ClientsPlugin } from "./clients.plugin";
import { CONFIG } from "../config";
import { ContextService } from "../services/context.service";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .use(ClientsPlugin)

  .decorate("assistantService", {} as AssistantService)
  .decorate("messageService", {} as MessageService)
  .decorate("contextService", {} as ContextService)
  .onStart(
    async ({
      decorator
    }) => {
      logger.debug("Initializing services");

      decorator.contextService = new ContextService(
        decorator.rwaClient,
        decorator.portfolioClient,
      );

      decorator.assistantService = new AssistantService(decorator.assistantRepository);
      decorator.messageService = new MessageService(
        decorator.messageRepository,
        decorator.assistantRepository,
        decorator.contextService,
        decorator.openRouterClient,
        CONFIG.OPENROUTER.MODEL
      );
    }
  );
