import { ReactionRepository } from '../repositories/reaction.repository';
import type { IReactionEntity } from '../models/entity/reaction.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';

export class ReactionsService {
  constructor(private readonly reactionRepository: ReactionRepository) {}

  private formatReaction(reaction: IReactionEntity) {
    return {
      id: reaction._id.toString(),
      parentId: reaction.parentId,
      parentType: reaction.parentType,
      userId: reaction.userId,
      reaction: reaction.reaction,
      createdAt: reaction.createdAt,
      updatedAt: reaction.updatedAt,
    };
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ parentId: a[0].parentId, userId: a[0].userId, reaction: a[0].reaction }),
  })
  async setReaction(data: { parentId: string; parentType: string; userId: string; reaction: string }) {
    setSpanAttributes({
      parentId: data.parentId,
      parentType: data.parentType,
      userId: data.userId,
      reaction: data.reaction,
    });

    const reaction = await this.reactionRepository.create(data);
    return this.formatReaction(reaction);
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ parentId: a[0].parentId, userId: a[0].userId, reaction: a[0].reaction }),
  })
  async resetReaction(data: { parentId: string; parentType: string; userId: string; reaction: string }) {
    setSpanAttributes({
      parentId: data.parentId,
      parentType: data.parentType,
      userId: data.userId,
      reaction: data.reaction,
    });

    const reaction = await this.reactionRepository.delete(data);
    return this.formatReaction(reaction);
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ parentId: a[0].parentId, parentType: a[0].parentType, userId: a[0].userId }),
  })
  async getEntityReactions(params: { parentId: string; parentType: string; userId?: string }) {
    setSpanAttributes({
      parentId: params.parentId,
      parentType: params.parentType,
      ...(params.userId !== undefined && { userId: params.userId }),
    });

    const [reactions, userReactions] = await Promise.all([
      this.reactionRepository.getEntityStats(params.parentId, params.parentType),
      params.userId ? this.reactionRepository.getUserReaction(params.parentId, params.userId) : [],
    ]);

    return {
      reactions,
      userReactions: userReactions.map((r) => r.reaction),
    };
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ limit: a[0].limit, offset: a[0].offset }),
  })
  async getReactions(
    params: {
      filter?: Record<string, any>;
      sort?: { [key: string]: any };
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const filter = params.filter ?? {};
    setSpanAttributes({
      entityType: 'reactions',
      ...(filter.parentId !== undefined && { parentId: filter.parentId }),
      ...(filter.parentType !== undefined && { parentType: filter.parentType }),
      ...(filter.userId !== undefined && { userId: filter.userId }),
      ...(filter.reaction !== undefined && { reaction: filter.reaction }),
    });

    const { filter: _filter = {}, sort = { createdAt: 'desc' }, limit = 100, offset = 0 } = params;

    const reactions = await this.reactionRepository.findAll(_filter, sort, limit, offset);
    return reactions.map((reaction) => this.formatReaction(reaction));
  }
}
