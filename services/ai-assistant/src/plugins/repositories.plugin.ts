import { Elysia } from "elysia";
import mongoose from "mongoose";
import { AssistantRepository } from "../repositories/assistant.repository";
import { MessageRepository } from "../repositories/message.repository";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const assistantRepository = withTraceSync(
    'ai-assistant.init.repositories.assistant',
    () => new AssistantRepository()
  );

  const messageRepository = withTraceSync(
    'ai-assistant.init.repositories.message',
    () => new MessageRepository()
  );

  await withTraceAsync(
    'ai-assistant.init.repositories_plugin.mongoose',
    async (ctx) => {
      mongoose.connection.once('connected', () => {
        console.log('ai-assistant mongoose connected')
        ctx.end();
      })
      await mongoose.connect(mongoUri);
    }
  );

  const plugin = withTraceSync(
    'ai-assistant.init.repositories.plugin',
    () => new Elysia({ name: "Repositories" })
      .decorate("assistantRepository", assistantRepository)
      .decorate("messageRepository", messageRepository)
      .onStop(async () => {
        await withTraceAsync(
          'ai-assistant.stop.repositories_plugin',
          async () => {
            await mongoose.disconnect();
          }
        );
      })
  );

  return plugin;
}

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>
