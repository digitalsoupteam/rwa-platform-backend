import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  deletePostRequest,
  deletePostResponse,
} from "../../models/validation/blogs.validation";

export const deletePostController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "DeletePostController" })
    .use(servicesPlugin)
    .post(
      "/deletePost",
      async ({ body, blogsService }) => {
        logger.info(
          `POST /deletePost Deleting post`
        );

        return await blogsService.deletePost(body.id);
      },
      {
          body: deletePostRequest,
        response: deletePostResponse,
      }
    );
};