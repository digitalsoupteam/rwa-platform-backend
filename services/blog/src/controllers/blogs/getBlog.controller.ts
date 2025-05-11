import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
    getBlogRequest,
    getBlogResponse,
} from "../../models/validation/blogs.validation";

export const getBlogController = new Elysia()
    .use(ServicesPlugin)
    .post(
        "/getBlog",
        async ({ body, blogsService }) => {
            logger.info(
                `POST /getBlog - Getting blog`
            );

            return await blogsService.getBlog(body.id);
        },
        {
            body: getBlogRequest,
            response: getBlogResponse,
        }
    );