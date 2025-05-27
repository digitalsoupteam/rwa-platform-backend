import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder } from "mongoose";
import {
  ReactionEntity,
  IReactionEntity,
} from "../models/entity/reaction.entity";

export class ReactionRepository {
  constructor(private readonly model = ReactionEntity) { }

  async create(data: Pick<IReactionEntity, "parentId" | "parentType" | "userId" | "reaction">) {
    logger.debug(`Creating reaction for parent: ${data.parentId} by user: ${data.userId}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async delete(parentId: string, userId: string) {
    logger.debug(`Deleting reaction for parent: ${parentId} by user: ${userId}`);
    const doc = await this.model.findOneAndDelete({ parentId, userId }).lean();

    if (!doc) {
      throw new NotFoundError("Reaction", `${parentId}:${userId}`);
    }

    return doc;
  }

  async exists(parentId: string, userId: string): Promise<boolean> {
    logger.debug(`Checking reaction existence for parent: ${parentId} by user: ${userId}`);
    const doc = await this.model.findOne({ parentId, userId }).lean();
    return !!doc;
  }

  async findById(id: string) {
    logger.debug(`Finding reaction by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Reaction", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding reactions with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }

  async countByParentId(parentId: string): Promise<number> {
    logger.debug(`Counting reactions for parent: ${parentId}`);
    return await this.model.countDocuments({ parentId });
  }

  async findByUserId(
    userId: string,
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding reactions by user: ${userId}`);
    const docs = await this.model
      .find({ userId })
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();

    return docs;
  }
}