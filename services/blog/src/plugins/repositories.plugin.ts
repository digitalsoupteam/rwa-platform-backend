import { Elysia } from "elysia";
import mongoose from "mongoose";
import { BlogRepository } from "../repositories/blog.repository";
import { PostRepository } from "../repositories/post.repository";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const blogRepository = withTraceSync(
    'blog.init.repositories.blog',
    () => new BlogRepository()
  );

  const postRepository = withTraceSync(
    'blog.init.repositories.post',
    () => new PostRepository()
  );

  await withTraceAsync(
    'blog.init.repositories_plugin.mongoose',
    async (ctx) => {
      mongoose.connection.once('connected', () => {
        console.log('blog mongoose connected')
        ctx.end();
      })
      await mongoose.connect(mongoUri);
    }
  );

  const plugin = withTraceSync(
    'blog.init.repositories.plugin',
    () => new Elysia({ name: "Repositories" })
      .decorate("blogRepository", blogRepository)
      .decorate("postRepository", postRepository)
      .onStop(async () => {
        await withTraceAsync(
          'blog.stop.repositories_plugin',
          async () => {
            await mongoose.disconnect();
          }
        );
      })
  );

  return plugin;
}

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>