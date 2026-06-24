import { GalleryRepository } from "../repositories/gallery.repository";
import { ImageRepository } from "../repositories/image.repository";
import { type SortOrder } from "mongoose";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";
import { MetricsDecorator } from "@shared/monitoring/src/metricsDecorator";
import { LogDecorator } from "@shared/monitoring/src/logDecorator";
import { setSpanAttributes } from "@shared/monitoring/src/tracing";


export class ImagesService {
  constructor(
    private readonly galleryRepository: GalleryRepository,
    private readonly imageRepository: ImageRepository
  ) {}

  /**
   * Creates a new gallery
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ["data.name"] })
  async createGallery(data: {
    name: string;
    parentId: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    grandParentId: string;
  }) {
    setSpanAttributes({
      userId: data.creator,
      parentId: data.parentId,
    });

    const gallery = await this.galleryRepository.create(data);

    return {
      id: gallery._id.toString(),
      name: gallery.name,
      parentId: gallery.parentId,
      ownerId: gallery.ownerId,
      ownerType: gallery.ownerType,
      creator: gallery.creator,
      grandParentId: gallery.grandParentId,
      createdAt: gallery.createdAt,
      updatedAt: gallery.updatedAt
    };
  }

  /**
   * Updates gallery name
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ["params"] })
  async updateGallery(params: { id: string, updateData: { name: string } }) {
    setSpanAttributes({
      entityId: params.id,
    });

    const gallery = await this.galleryRepository.update(params.id, params.updateData);

    return {
      id: gallery._id.toString(),
      name: gallery.name,
      parentId: gallery.parentId,
      ownerId: gallery.ownerId,
      ownerType: gallery.ownerType,
      creator: gallery.creator,
      grandParentId: gallery.grandParentId,
      createdAt: gallery.createdAt,
      updatedAt: gallery.updatedAt
    };
  }

  /**
   * Deletes a gallery and all its images
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ["id"] })
  async deleteGallery(id: string) {
    setSpanAttributes({
      entityId: id,
    });

    // First delete all images in the gallery
    const images = await this.imageRepository.findAll({ galleryIds: [id] });
    for (const image of images) {
      await this.imageRepository.delete(image._id.toString());
    }

    // Then delete the gallery itself
    await this.galleryRepository.delete(id);

    return { id };
  }

  /**
   * Gets gallery by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ["id"] })
  async getGallery(id: string) {
    setSpanAttributes({
      entityId: id,
    });

    const gallery = await this.galleryRepository.findById(id);

    return {
      id: gallery._id.toString(),
      name: gallery.name,
      parentId: gallery.parentId,
      ownerId: gallery.ownerId,
      ownerType: gallery.ownerType,
      creator: gallery.creator,
      grandParentId: gallery.grandParentId,
      createdAt: gallery.createdAt,
      updatedAt: gallery.updatedAt
    };
  }

  /**
   * Gets galleries list with filters, pagination and sorting
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ["params"] })
  async getGalleries(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    setSpanAttributes({});

    const galleries = await this.galleryRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return galleries.map(gallery => ({
      id: gallery._id.toString(),
      name: gallery.name,
      parentId: gallery.parentId,
      ownerId: gallery.ownerId,
      ownerType: gallery.ownerType,
      creator: gallery.creator,
      grandParentId: gallery.grandParentId,
      createdAt: gallery.createdAt,
      updatedAt: gallery.updatedAt
    }));
  }

  /**
   * Creates a new image in a gallery
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ["data.name"] })
  async createImage(data: {
    galleryId: string;
    name: string;
    description: string;
    link: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
  }) {
    setSpanAttributes({
      userId: data.creator,
      galleryId: data.galleryId,
      parentId: data.parentId,
    });

    const image = await this.imageRepository.create(data);

    return {
      id: image._id.toString(),
      galleryId: image.galleryId.toString(),
      name: image.name,
      description: image.description,
      link: image.link,
      ownerId: image.ownerId,
      ownerType: image.ownerType,
      creator: image.creator,
      parentId: image.parentId,
      grandParentId: image.grandParentId,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt
    };
  }

  /**
   * Updates image
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ["params"] })
  async updateImage(params: {
    id: string;
    updateData: {
      name?: string;
      description?: string;
      link?: string;
    }
  }) {
    setSpanAttributes({
      imageId: params.id,
    });

    const image = await this.imageRepository.update(params.id, params.updateData);

    return {
      id: image._id.toString(),
      galleryId: image.galleryId.toString(),
      name: image.name,
      description: image.description,
      link: image.link,
      ownerId: image.ownerId,
      ownerType: image.ownerType,
      creator: image.creator,
      parentId: image.parentId,
      grandParentId: image.grandParentId,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt
    };
  }

  /**
   * Deletes image
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ["id"] })
  async deleteImage(id: string) {
    setSpanAttributes({
      imageId: id,
    });
    await this.imageRepository.delete(id);
    return { id };
  }

  /**
   * Gets image by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ["id"] })
  async getImage(id: string) {
    setSpanAttributes({
      imageId: id,
    });

    const image = await this.imageRepository.findById(id);

    return {
      id: image._id.toString(),
      galleryId: image.galleryId.toString(),
      name: image.name,
      description: image.description,
      link: image.link,
      ownerId: image.ownerId,
      ownerType: image.ownerType,
      creator: image.creator,
      parentId: image.parentId,
      grandParentId: image.grandParentId,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt
    };
  }

  /**
   * Gets images list with filters, pagination and sorting
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ["params"] })
  async getImages(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    setSpanAttributes({});

    const images = await this.imageRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return images.map(image => ({
      id: image._id.toString(),
      galleryId: image.galleryId.toString(),
      name: image.name,
      description: image.description,
      link: image.link,
      ownerId: image.ownerId,
      ownerType: image.ownerType,
      creator: image.creator,
      parentId: image.parentId,
      grandParentId: image.grandParentId,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt
    }));
  }
}