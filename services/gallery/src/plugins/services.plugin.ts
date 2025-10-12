import { Elysia } from "elysia";
import { ImagesService } from "../services/images.service";
import { type RepositoriesPlugin } from "./repositories.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin
) => {
  const imagesService = withTraceSync(
    'gallery.init.services.images',
    () => new ImagesService(
      repositoriesPlugin.decorator.galleryRepository,
      repositoriesPlugin.decorator.imageRepository
    )
  );

  const plugin = withTraceSync(
    'gallery.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .decorate("imagesService", imagesService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>