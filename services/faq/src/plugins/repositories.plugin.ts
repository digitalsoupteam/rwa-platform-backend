import { Elysia } from "elysia";
import mongoose from "mongoose";
import { TopicRepository } from "../repositories/topic.repository";
import { AnswerRepository } from "../repositories/answer.repository";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const topicRepository = withTraceSync(
    'faq.init.repositories.topic',
    () => new TopicRepository()
  );

  const answerRepository = withTraceSync(
    'faq.init.repositories.answer',
    () => new AnswerRepository()
  );

  await withTraceAsync(
    'faq.init.repositories_plugin.mongoose',
    async (ctx) => {
      mongoose.connection.once('connected', () => {
        console.log('faq mongoose connected')
        ctx.end();
      })
      await mongoose.connect(mongoUri);
    }
  );

  const plugin = withTraceSync(
    'faq.init.repositories.plugin',
    () => new Elysia({ name: "Repositories" })
      .decorate("topicRepository", topicRepository)
      .decorate("answerRepository", answerRepository)
      .onStop(async () => {
        await withTraceAsync(
          'faq.stop.repositories_plugin',
          async () => {
            await mongoose.disconnect();
          }
        );
      })
  );

  return plugin;
}

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>