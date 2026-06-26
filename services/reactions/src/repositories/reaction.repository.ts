import { AppError } from '@shared/errors/app-errors';
import { ReactionEntity } from '../models/entity/reaction.entity';
import type { IReactionEntity } from '../models/entity/reaction.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class ReactionRepository {
  constructor(private readonly model = ReactionEntity) {}

  @TraceDecorator()
  async create(data: Pick<IReactionEntity, 'parentId' | 'parentType' | 'userId' | 'reaction'>) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async delete(data: Pick<IReactionEntity, 'parentId' | 'parentType' | 'userId' | 'reaction'>) {
    const doc = await this.model.findOneAndDelete(data).lean();

    if (!doc) {
      throw new AppError({
        message: `Reaction ${data.parentId}:${data.userId}:${data.reaction} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }

  @TraceDecorator()
  async getEntityStats(parentId: string, parentType: string): Promise<Record<string, number>> {
    const reactions = await this.model
      .aggregate([{ $match: { parentId, parentType } }, { $group: { _id: '$reaction', count: { $sum: 1 } } }])
      .exec();

    return reactions.reduce(
      (acc, { _id, count }) => ({
        ...acc,
        [_id]: count,
      }),
      {},
    );
  }

  @TraceDecorator()
  async getUserReaction(parentId: string, userId: string) {
    return await this.model.find({ parentId, userId }).lean();
  }

  @TraceDecorator()
  async findAll(
    filter: any = {},
    sort: { [key: string]: any } = { createdAt: 'desc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    return await this.model.find(filter).sort(sort).skip(offset).limit(limit).lean();
  }
}
