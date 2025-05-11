import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  ImageEntity,
  IImageEntity,
} from "../models/entity/image.entity";

export class ImageRepository {
  constructor(private readonly model = ImageEntity) {}

  async create(data: {galleryId: Types.ObjectId | string} & Pick<IImageEntity, "name" | "description" | "link" | "ownerId" | "ownerType" | "creator" | "parentId" | "grandParentId">) {
    logger.debug(`Creating image: ${data.name}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<Pick<IImageEntity, "name" | "description" | "link">>) {
    logger.debug(`Updating image: ${id}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("Image", id);
    }

    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting image: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("Image", id);
    }

    return id;
  }

  async findById(id: string) {
    logger.debug(`Finding image by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Image", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {

    logger.debug(`Finding images with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}
