import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getPostRequest,
  getPostResponse,
} from "../../models/validation/blogs.validation";

export const getPostController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getPost",
    async ({ body, blogsService }) => {
      logger.info(
        `POST /getPost - Getting post`
      );

      return await blogsService.getPost(body.id);
    },
    {
        body: getPostRequest,
      response: getPostResponse,
    }
  );