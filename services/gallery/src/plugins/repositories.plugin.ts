import { Elysia } from "elysia";
import mongoose from "mongoose";
import { GalleryRepository } from "../repositories/gallery.repository";
import { ImageRepository } from "../repositories/image.repository";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const galleryRepository = withTraceSync(
    'gallery.init.repositories.gallery',
    () => new GalleryRepository()
  );

  const imageRepository = withTraceSync(
    'gallery.init.repositories.image',
    () => new ImageRepository()
  );

  await withTraceAsync(
    'gallery.init.repositories_plugin.mongoose',
    async (ctx) => {
      mongoose.connection.once('connected', () => {
        console.log('gallery mongoose connected')
        ctx.end();
      })
      await mongoose.connect(mongoUri);
    }
  );

  const plugin = withTraceSync(
    'gallery.init.repositories.plugin',
    () => new Elysia({ name: "Repositories" })
      .decorate("galleryRepository", galleryRepository)
      .decorate("imageRepository", imageRepository)
      .onStop(async () => {
        await withTraceAsync(
          'gallery.stop.repositories_plugin',
          async () => {
            await mongoose.disconnect();
          }
        );
      })
  );

  return plugin;
}

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>