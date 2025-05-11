import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  GalleryEntity,
  IGalleryEntity,
} from "../models/entity/gallery.entity";

export class GalleryRepository {
  constructor(private readonly model = GalleryEntity) {}

  async create(data: Pick<IGalleryEntity, "name" | "ownerId" | "ownerType" | "creator" | "parentId" | "grandParentId">) {
    logger.debug(`Creating gallery: ${data.name}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<Pick<IGalleryEntity, "name">>) {
    logger.debug(`Updating gallery: ${id}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("Gallery", id);
    }

    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting gallery: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("Gallery", id);
    }

    return id;
  }

  async findById(id: string) {
    logger.debug(`Finding gallery by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Gallery", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {

    logger.debug(`Finding galleries with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}