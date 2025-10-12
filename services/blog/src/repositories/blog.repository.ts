import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  BlogEntity,
  IBlogEntity,
} from "../models/entity/blog.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class BlogRepository {
  constructor(private readonly model = BlogEntity) {}

  async create(data: Pick<IBlogEntity, "name" | "ownerId" | "ownerType" | "creator" | "parentId" | "grandParentId">) {
    logger.debug(`Creating blog: ${data.name}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<Pick<IBlogEntity, "name">>) {
    logger.debug(`Updating blog: ${id}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("Blog", id);
    }

    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting blog: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("Blog", id);
    }

    return id;
  }

  async findById(id: string) {
    logger.debug(`Finding blog by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Blog", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {

    logger.debug(`Finding blogs with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}