import { logger } from "@shared/monitoring/src/logger";
import { GalleryRepository } from "../repositories/gallery.repository";
import { ImageRepository } from "../repositories/image.repository";
import { FilterQuery, SortOrder, Types } from "mongoose";

export class ImagesService {
  constructor(
    private readonly galleryRepository: GalleryRepository,
    private readonly imageRepository: ImageRepository
  ) {}

  /**
   * Creates a new gallery
   */
  async createGallery(data: {
    name: string;
    parentId: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    grandParentId: string;
  }) {
    logger.debug("Creating new gallery", { name: data.name });
    
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
  async updateGallery(params: { id: string, updateData: { name: string } }) {
    logger.debug("Updating gallery", params);
    
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
  async deleteGallery(id: string) {
    logger.debug("Deleting gallery and its images", { id });
    
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
  async getGallery(id: string) {
    logger.debug("Getting gallery", { id });
    
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
  async getGalleries(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting galleries list", params);
    
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
    logger.debug("Creating new image", { name: data.name });
    
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
  async updateImage(params: {
    id: string;
    updateData: {
      name?: string;
      description?: string;
      link?: string;
    }
  }) {
    logger.debug("Updating image", params);
    
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
  async deleteImage(id: string) {
    logger.debug("Deleting image", { id });
    await this.imageRepository.delete(id);
    return { id };
  }

  /**
   * Gets image by ID
   */
  async getImage(id: string) {
    logger.debug("Getting image", { id });
    
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
  async getImages(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting images list", params);
    
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