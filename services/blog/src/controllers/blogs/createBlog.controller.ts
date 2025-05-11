import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createBlogRequest,
  createBlogResponse,
} from "../../models/validation/blogs.validation";

export const createBlogController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createBlog",
    async ({ body, blogsService }) => {
      logger.info(
        `POST /createBlog - Creating blog with name: ${body.name}`
      );

      return await blogsService.createBlog(body);
    },
    {
      body: createBlogRequest,
      response: createBlogResponse,
    }
  );