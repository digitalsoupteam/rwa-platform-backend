import { logger } from "@shared/monitoring/src/logger";
import { FilterQuery, SortOrder } from "mongoose";
import { ReactionRepository } from "../repositories/reaction.repository";
import { IReactionEntity } from "../models/entity/reaction.entity";

export class ReactionsService {
  constructor(
    private readonly reactionRepository: ReactionRepository
  ) {}

  private formatReaction(reaction: IReactionEntity) {
    return {
      id: reaction._id.toString(),
      parentId: reaction.parentId,
      parentType: reaction.parentType,
      userId: reaction.userId,
      reaction: reaction.reaction,
      createdAt: reaction.createdAt,
      updatedAt: reaction.updatedAt
    };
  }

  async setReaction(data: {
    parentId: string;
    parentType: string;
    userId: string;
    reaction: string;
  }) {
    logger.debug("Setting reaction", {
      parentId: data.parentId,
      userId: data.userId,
      reaction: data.reaction
    });
    
    const reaction = await this.reactionRepository.create(data);
    return this.formatReaction(reaction);
  }

  async resetReaction(data: {
    parentId: string;
    parentType: string;
    userId: string;
    reaction: string;
  }) {
    logger.debug("Resetting reaction", {
      parentId: data.parentId,
      userId: data.userId,
      reaction: data.reaction
    });

    const reaction = await this.reactionRepository.delete(data);
    return this.formatReaction(reaction);
  }

  async getEntityReactions(params: {
    parentId: string;
    parentType: string;
    userId?: string;
  }) {
    logger.debug("Getting entity reactions", {
      parentId: params.parentId,
      parentType: params.parentType,
      userId: params.userId
    });

    const [reactions, userReactions] = await Promise.all([
      this.reactionRepository.getEntityStats(params.parentId, params.parentType),
      params.userId ?
        this.reactionRepository.getUserReaction(params.parentId, params.userId) :
        []
    ]);

    return {
      reactions,
      userReactions: userReactions.map(r => r.reaction)
    };
  }

  async getReactions(params: {
    filter?: any;
    sort?: { [key: string]: any };
    limit?: number;
    offset?: number;
  } = {}) {
    logger.debug("Getting reactions", params);

    const {
      filter = {},
      sort = { createdAt: "desc" },
      limit = 100,
      offset = 0
    } = params;

    const reactions = await this.reactionRepository.findAll(filter, sort, limit, offset);
    return reactions.map(reaction => this.formatReaction(reaction));
  }
}