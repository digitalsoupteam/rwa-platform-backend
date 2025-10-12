import { Elysia } from "elysia";
import { FaqService } from "../services/faq.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (repositoriesPlugin: RepositoriesPlugin) => {
  const faqService = withTraceSync(
    'faq.init.services.faq',
    () => new FaqService(
      repositoriesPlugin.decorator.topicRepository,
      repositoriesPlugin.decorator.answerRepository
    )
  );

  const plugin = withTraceSync(
    'faq.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .decorate("faqService", faqService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>