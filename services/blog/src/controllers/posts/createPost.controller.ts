import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createPostRequest,
  createPostResponse,
} from "../../models/validation/blogs.validation";

export const createPostController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createPost",
    async ({ body, blogsService }) => {
      logger.info(
        `POST /createPost - Creating post with title: ${body.title}`
      );

      return await blogsService.createPost(body);
    },
    {
      body: createPostRequest,
      response: createPostResponse,
    }
  );