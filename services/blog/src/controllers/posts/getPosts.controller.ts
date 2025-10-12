import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getPostsRequest,
  getPostsResponse,
} from "../../models/validation/blogs.validation";

export const getPostsController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetPostsController" })
    .use(servicesPlugin)
    .post(
      "/getPosts",
      async ({ body, blogsService }) => {
        logger.info(
          `POST /getPosts - Getting posts list`
        );

        return await blogsService.getPosts(body);
      },
      {
        body: getPostsRequest,
        response: getPostsResponse,
      }
    );
};