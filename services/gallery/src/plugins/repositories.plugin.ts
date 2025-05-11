import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { GalleryRepository } from "../repositories/gallery.repository";
import { ImageRepository } from "../repositories/image.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("galleryRepository", {} as GalleryRepository)
  .decorate("imageRepository", {} as ImageRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");
      
      decorator.galleryRepository = new GalleryRepository();
      decorator.imageRepository = new ImageRepository();

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