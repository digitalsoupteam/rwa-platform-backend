import { Elysia } from "elysia";
import { createGalleryController } from "../controllers/galleries/createGallery.controller";
import { updateGalleryController } from "../controllers/galleries/updateGallery.controller";
import { deleteGalleryController } from "../controllers/galleries/deleteGallery.controller";
import { getGalleryController } from "../controllers/galleries/getGallery.controller";
import { getGalleriesController } from "../controllers/galleries/getGalleries.controller";
import { createImageController } from "../controllers/images/createImage.controller";
import { updateImageController } from "../controllers/images/updateImage.controller";
import { deleteImageController } from "../controllers/images/deleteImage.controller";
import { getImageController } from "../controllers/images/getImage.controller";
import { getImagesController } from "../controllers/images/getImages.controller";
import { withTraceSync } from "@shared/monitoring/src/tracing";
import type { ServicesPlugin } from "./services.plugin";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const createGalleryCtrl = withTraceSync(
    'gallery.init.controllers.create_gallery',
    () => createGalleryController(servicesPlugin)
  );

  const updateGalleryCtrl = withTraceSync(
    'gallery.init.controllers.update_gallery',
    () => updateGalleryController(servicesPlugin)
  );

  const deleteGalleryCtrl = withTraceSync(
    'gallery.init.controllers.delete_gallery',
    () => deleteGalleryController(servicesPlugin)
  );

  const getGalleryCtrl = withTraceSync(
    'gallery.init.controllers.get_gallery',
    () => getGalleryController(servicesPlugin)
  );

  const getGalleriesCtrl = withTraceSync(
    'gallery.init.controllers.get_galleries',
    () => getGalleriesController(servicesPlugin)
  );

  const createImageCtrl = withTraceSync(
    'gallery.init.controllers.create_image',
    () => createImageController(servicesPlugin)
  );

  const updateImageCtrl = withTraceSync(
    'gallery.init.controllers.update_image',
    () => updateImageController(servicesPlugin)
  );

  const deleteImageCtrl = withTraceSync(
    'gallery.init.controllers.delete_image',
    () => deleteImageController(servicesPlugin)
  );

  const getImageCtrl = withTraceSync(
    'gallery.init.controllers.get_image',
    () => getImageController(servicesPlugin)
  );

  const getImagesCtrl = withTraceSync(
    'gallery.init.controllers.get_images',
    () => getImagesController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'gallery.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(createGalleryCtrl)
      .use(updateGalleryCtrl)
      .use(deleteGalleryCtrl)
      .use(getGalleryCtrl)
      .use(getGalleriesCtrl)
      .use(createImageCtrl)
      .use(updateImageCtrl)
      .use(deleteImageCtrl)
      .use(getImageCtrl)
      .use(getImagesCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>