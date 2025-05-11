import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { BlogRepository } from "../repositories/blog.repository";
import { PostRepository } from "../repositories/post.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("blogRepository", {} as BlogRepository)
  .decorate("postRepository", {} as PostRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");
      
      decorator.blogRepository = new BlogRepository();
      decorator.postRepository = new PostRepository();

      logger.info("Connecting to MongoDB", {
        uri: CONFIG.MONGODB.URI,
      });

      await mongoose.connect(CONFIG.MONGODB.URI);

      logger.info("MongoDB connected successfully");
    }
  )
  .onStop(async () => {
    logger.info("Disconnecting from MongoDB");
    await mongoose.disconnect();
    logger.info("MongoDB disconnected successfully");
  });