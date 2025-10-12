import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  DocumentEntity,
  IDocumentEntity,
} from "../models/entity/document.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class DocumentRepository {
  constructor(private readonly model = DocumentEntity) {}

  async create(data: {folderId: Types.ObjectId | string} & Pick<IDocumentEntity, "name" | "link" | "ownerId" | "ownerType" | "creator" | "parentId" | "grandParentId">) {
    logger.debug(`Creating document: ${data.name}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<Pick<IDocumentEntity, "name" | "link">>) {
    logger.debug(`Updating document: ${id}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("Document", id);
    }

    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting document: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("Document", id);
    }

    return id;
  }

  async findById(id: string) {
    logger.debug(`Finding document by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Document", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {

    logger.debug(`Finding documents with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}