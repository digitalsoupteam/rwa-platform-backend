import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import {
  ReactionEntity,
  IReactionEntity,
} from "../models/entity/reaction.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class ReactionRepository {
  constructor(private readonly model = ReactionEntity) { }

  async create(data: Pick<IReactionEntity, "parentId" | "parentType" | "userId" | "reaction">) {
    logger.debug(`Creating reaction for parent: ${data.parentId} by user: ${data.userId}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async delete(data: Pick<IReactionEntity, "parentId" | "parentType" | "userId" | "reaction">) {
    logger.debug(`Deleting reaction for parent: ${data.parentId} by user: ${data.userId}`);
    const doc = await this.model.findOneAndDelete(data).lean();

    if (!doc) {
      throw new NotFoundError("Reaction", `${data.parentId}:${data.userId}:${data.reaction}`);
    }

    return doc;
  }

  async getEntityStats(parentId: string, parentType: string): Promise<Record<string, number>> {
    logger.debug(`Getting reaction stats for parent: ${parentId}, type: ${parentType}`);
    
    const reactions = await this.model.aggregate([
      { $match: { parentId, parentType } },
      { $group: { _id: "$reaction", count: { $sum: 1 } } }
    ]).exec();

    return reactions.reduce((acc, {_id, count}) => ({
      ...acc,
      [_id]: count
    }), {});
  }

  async getUserReaction(parentId: string, userId: string) {
    logger.debug(`Getting user reactions for parent: ${parentId}, user: ${userId}`);
    
    return await this.model
      .find({ parentId, userId })
      .lean();
  }

  async findAll(
    filter: any = {},
    sort: { [key: string]: any } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding reactions with filter: ${JSON.stringify(filter)}`);
    
    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}