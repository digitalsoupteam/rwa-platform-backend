import { Elysia } from "elysia";
import { QuestionsService } from "../services/questions.service";
import type { RepositoriesPlugin } from "./repositories.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin
) => {
  const questionsService = withTraceSync(
    'questions.init.services.questions',
    () => new QuestionsService(
      repositoriesPlugin.decorator.topicRepository,
      repositoriesPlugin.decorator.questionRepository,
      repositoriesPlugin.decorator.questionLikesRepository
    )
  );

  const plugin = withTraceSync(
    'questions.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .decorate("questionsService", questionsService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>