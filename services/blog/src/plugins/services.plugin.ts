import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { BlogsService } from "../services/blogs.service";
import { RepositoriesPlugin } from "./repositories.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .decorate("blogsService", {} as BlogsService)
  .onStart(
    async ({
      decorator
    }) => {
      logger.debug("Initializing services");

      decorator.blogsService = new BlogsService(
        decorator.blogRepository,
        decorator.postRepository
      );
    }
  );