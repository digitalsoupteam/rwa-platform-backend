import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  TopicEntity,
  ITopicEntity,
} from "../models/entity/topic.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class TopicRepository {
  constructor(private readonly model = TopicEntity) {}

  async create(data: Pick<ITopicEntity, "name" | "ownerId" | "ownerType" | "creator" | "parentId" | "grandParentId">) {
    logger.debug(`Creating topic: ${data.name}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<Pick<ITopicEntity, "name">>) {
    logger.debug(`Updating topic: ${id}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("Topic", id);
    }

    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting topic: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("Topic", id);
    }

    return id;
  }

  async findById(id: string) {
    logger.debug(`Finding topic by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Topic", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {

    logger.debug(`Finding topics with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}