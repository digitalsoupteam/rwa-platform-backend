import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updatePostRequest,
  updatePostResponse,
} from "../../models/validation/blogs.validation";

export const updatePostController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "UpdatePostController" })
    .use(servicesPlugin)
    .post(
      "/updatePost",
      async ({ body, blogsService }) => {
        logger.info(
          `POST /updatePost - Updating post: ${body.id}`
        );

        return await blogsService.updatePost(body);
      },
      {
        body: updatePostRequest,
        response: updatePostResponse,
      }
    );
};