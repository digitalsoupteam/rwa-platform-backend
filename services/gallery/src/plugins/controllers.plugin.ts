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

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  // Galleries controllers
  .use(createGalleryController)
  .use(updateGalleryController)
  .use(deleteGalleryController)
  .use(getGalleryController)
  .use(getGalleriesController)
  // Images controllers
  .use(createImageController)
  .use(updateImageController)
  .use(deleteImageController)
  .use(getImageController)
  .use(getImagesController);