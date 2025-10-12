import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { MessageEntity, IMessageEntity } from "../models/entity/message.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class MessageRepository {
  constructor(private readonly model = MessageEntity) {}

  async create(data: Pick<IMessageEntity, "assistantId" | "text">) {
    logger.debug(`Creating message for assistant: ${data.assistantId}`);
    const doc = await this.model.create<typeof this.model>(data);
    return doc.toObject();
  }

  async update(id: string, data: Pick<IMessageEntity, "text">) {
    logger.debug(`Updating message: ${id}`);
    const doc = await this.model.findByIdAndUpdate(
      id,
      data,
      { new: true }
    ).lean();

    if (!doc) {
      throw new NotFoundError("Message", id);
    }

    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting message: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("Message", id);
    }

    return id;
  }

  async findById(id: string) {
    logger.debug(`Finding message by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Message", id);
    }

    return doc;
  }

  async findByAssistantId(
    assistantId: string,
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding messages for assistant: ${assistantId}`);
    const docs = await this.model
      .find({ assistantId })
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();

    return docs;
  }

  async findAll(
    filters: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding messages with filters: ${JSON.stringify(filters)}`);
    const docs = await this.model
      .find(filters)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();

    return docs;
  }
}