import { Elysia } from "elysia";
import { AssistantService } from "../services/assistant.service";
import { MessageService } from "../services/message.service";
import { ContextService } from "../services/context.service";
import type { RepositoriesPlugin } from "./repositories.plugin";
import type { ClientsPlugin } from "./clients.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin,
  clientsPlugin: ClientsPlugin,
  openRouterModel: string
) => {
  const contextService = withTraceSync(
    'ai-assistant.init.services.context',
    () => new ContextService(
      clientsPlugin.decorator.rwaClient,
      clientsPlugin.decorator.portfolioClient,
    )
  );

  const assistantService = withTraceSync(
    'ai-assistant.init.services.assistant',
    () => new AssistantService(repositoriesPlugin.decorator.assistantRepository)
  );

  const messageService = withTraceSync(
    'ai-assistant.init.services.message',
    () => new MessageService(
      repositoriesPlugin.decorator.messageRepository,
      repositoriesPlugin.decorator.assistantRepository,
      contextService,
      clientsPlugin.decorator.openRouterClient,
      openRouterModel
    )
  );

  const plugin = withTraceSync(
    'ai-assistant.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .use(clientsPlugin)
      .decorate("assistantService", assistantService)
      .decorate("messageService", messageService)
      .decorate("contextService", contextService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>
