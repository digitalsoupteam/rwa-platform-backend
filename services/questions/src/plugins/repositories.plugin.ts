import { Elysia } from "elysia";
import mongoose from "mongoose";
import { TopicRepository } from "../repositories/topic.repository";
import { QuestionRepository } from "../repositories/question.repository";
import { QuestionLikesRepository } from "../repositories/questionLikes.repository";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const topicRepository = withTraceSync(
    'questions.init.repositories.topic',
    () => new TopicRepository()
  );

  const questionRepository = withTraceSync(
    'questions.init.repositories.question',
    () => new QuestionRepository()
  );

  const questionLikesRepository = withTraceSync(
    'questions.init.repositories.questionLikes',
    () => new QuestionLikesRepository()
  );

  await withTraceAsync(
    'questions.init.repositories_plugin.mongoose',
    async (ctx) => {
      mongoose.connection.once('connected', () => {
        console.log('questions mongoose connected')
        ctx.end();
      })
      await mongoose.connect(mongoUri);
    }
  );

  const plugin = withTraceSync(
    'questions.init.repositories.plugin',
    () => new Elysia({ name: "Repositories" })
      .decorate("topicRepository", topicRepository)
      .decorate("questionRepository", questionRepository)
      .decorate("questionLikesRepository", questionLikesRepository)
      .onStop(async () => {
        await withTraceAsync(
          'questions.stop.repositories_plugin',
          async () => {
            await mongoose.disconnect();
          }
        );
      })
  );

  return plugin;
}

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>