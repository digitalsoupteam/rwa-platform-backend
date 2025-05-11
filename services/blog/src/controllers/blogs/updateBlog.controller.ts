import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateBlogRequest,
  updateBlogResponse,
} from "../../models/validation/blogs.validation";

export const updateBlogController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/updateBlog",
    async ({ body, blogsService }) => {
      logger.info(
        `POST /updateBlog - Updating blog: ${body.id}`
      );

      return await blogsService.updateBlog(body);
    },
    {
      body: updateBlogRequest,
      response: updateBlogResponse,
    }
  );