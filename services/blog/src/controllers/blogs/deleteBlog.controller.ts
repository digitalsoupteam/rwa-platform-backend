import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  deleteBlogRequest,
  deleteBlogResponse,
} from "../../models/validation/blogs.validation";

export const deleteBlogController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/deleteBlog",
    async ({ body, blogsService }) => {
      logger.info(
        `POST /deleteBlog - Deleting blog`
      );

      return await blogsService.deleteBlog(body.id);
    },
    {
      body: deleteBlogRequest,
      response: deleteBlogResponse,
    }
  );