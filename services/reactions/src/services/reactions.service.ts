import { logger } from "@shared/monitoring/src/logger";
import { FilterQuery, SortOrder } from "mongoose";
import { ReactionRepository } from "../repositories/reaction.repository";
import { IReactionEntity } from "../models/entity/reaction.entity";

export class ReactionsService {
  constructor(
    private readonly reactionRepository: ReactionRepository
  ) {}

  async toggle(data: {
    parentId: string;
    parentType: string;
    userId: string;
    reaction: string;
  }) {
    logger.debug("Toggling reaction", {
      parentId: data.parentId,
      userId: data.userId
    });

    const exists = await this.reactionRepository.exists(data.parentId, data.userId);

    if (exists) {
      return this.reactionRepository.delete(data.parentId, data.userId);
    }

    return this.reactionRepository.create(data);
  }

  async getAll(params: {
    filter?: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting reactions list", params);

    const reactions = await this.reactionRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return reactions.map(reaction => ({
      id: reaction._id.toString(),
      parentId: reaction.parentId,
      parentType: reaction.parentType,
      userId: reaction.userId,
      reaction: reaction.reaction,
      createdAt: reaction.createdAt,
      updatedAt: reaction.updatedAt
    }));
  }
}