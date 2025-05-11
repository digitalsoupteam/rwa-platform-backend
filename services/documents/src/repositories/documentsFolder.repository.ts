import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  DocumentsFolderEntity,
  IDocumentsFolderEntity,
} from "../models/entity/documentsFolder.entity";

export class DocumentsFolderRepository {
  constructor(private readonly model = DocumentsFolderEntity) {}

  async create(data: Pick<IDocumentsFolderEntity, "name" | "parentId" | "ownerId" | "ownerType" | "creator" | "grandParentId">) {
    logger.debug(`Creating documents folder: ${data.name}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<Pick<IDocumentsFolderEntity, "name">>) {
    logger.debug(`Updating documents folder: ${id}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("DocumentsFolder", id);
    }

    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting documents folder: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("DocumentsFolder", id);
    }

    return id;
  }

  async findById(id: string) {
    logger.debug(`Finding documents folder by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("DocumentsFolder", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {

    logger.debug(`Finding documents folders with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}