import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ImagesService } from "../services/images.service";
import { RepositoriesPlugin } from "./repositories.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .decorate("imagesService", {} as ImagesService)
  .onStart(
    async ({
      decorator
    }) => {
      logger.debug("Initializing services");

      decorator.imagesService = new ImagesService(
        decorator.galleryRepository,
        decorator.imageRepository
      );
    }
  );