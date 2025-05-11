import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  AssistantEntity,
  IAssistantEntity,
} from "../models/entity/assistant.entity";

export class AssistantRepository {
  constructor(private readonly model = AssistantEntity) {}

  async create(
    data: Pick<IAssistantEntity, "userId" | "name" | "contextPreferences">
  ) {
    logger.debug(`Creating assistant: ${data.name}`);

    const doc = await this.model.create<typeof this.model>(data);

    return doc.toObject();
  }

  async update(
    id: string,
    data: Partial<Pick<IAssistantEntity, "name" | "contextPreferences">>
  ) {
    logger.debug(`Updating assistant: ${id}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("Assistant", id);
    }

    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting assistant: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("Assistant", id);
    }

    return id;
  }

  async findById(id: string) {
    logger.debug(`Finding assistant by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Assistant", id);
    }

    return doc;
  }

  async findAll(
    filters: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding assistants with filters: ${JSON.stringify(filters)}`);
    const docs = await this.model
      .find(filters)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();

    return docs;
  }
}
