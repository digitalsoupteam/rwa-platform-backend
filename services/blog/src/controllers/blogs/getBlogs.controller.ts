import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getBlogsRequest,
  getBlogsResponse,
} from "../../models/validation/blogs.validation";

export const getBlogsController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getBlogs",
    async ({ body, blogsService }) => {
      logger.info(
        `POST /getBlogs  Getting blogs list`
      );

      return await blogsService.getBlogs(body);
    },
    {
        body: getBlogsRequest,
      response: getBlogsResponse,
    }
  );