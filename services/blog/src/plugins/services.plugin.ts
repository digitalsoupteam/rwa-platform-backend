import { Elysia } from "elysia";
import { BlogsService } from "../services/blogs.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin
) => {
  const blogsService = withTraceSync(
    'blog.init.services.blogs',
    () => new BlogsService(
      repositoriesPlugin.decorator.blogRepository,
      repositoriesPlugin.decorator.postRepository
    )
  );

  const plugin = withTraceSync(
    'blog.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .decorate("blogsService", blogsService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>