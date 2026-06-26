import { AppError } from '@shared/errors/app-errors';
import { Types } from 'mongoose';
import type { FilterQuery, SortOrder } from 'mongoose';
import { QuestionLikesEntity, type IQuestionLikesEntity } from '../models/entity/questionLikes.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class QuestionLikesRepository {
  constructor(private readonly model = QuestionLikesEntity) {}

  @TraceDecorator()
  async create(data: Pick<IQuestionLikesEntity, 'userId'> & { questionId: string }) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async delete(questionId: string, userId: string) {
    const doc = await this.model.findOneAndDelete({ questionId, userId }).lean();

    if (!doc) {
      throw new AppError({
        message: `QuestionLike ${questionId}:${userId} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }

  @TraceDecorator()
  async exists(questionId: string, userId: string): Promise<boolean> {
    const doc = await this.model.findOne({ questionId, userId }).lean();
    return !!doc;
  }

  @TraceDecorator()
  async findByQuestionId(
    questionId: Types.ObjectId | string,
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    const docs = await this.model.find({ questionId }).sort(sort).skip(offset).limit(limit).lean();

    return docs;
  }

  @TraceDecorator()
  async findByQuestionIds(
    questionIds: (Types.ObjectId | string)[],
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    const query: FilterQuery<typeof this.model> = {};

    if (questionIds.length === 1) {
      query.questionId = questionIds[0];
    } else if (questionIds.length > 1) {
      query.questionId = { $in: questionIds };
    }

    return await this.model.find(query).sort(sort).skip(offset).limit(limit).lean();
  }

  @TraceDecorator()
  async findByUserId(
    userId: string,
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    const docs = await this.model.find({ userId }).sort(sort).skip(offset).limit(limit).lean();

    return docs;
  }

  @TraceDecorator()
  async countByQuestionId(questionId: Types.ObjectId | string): Promise<number> {
    return await this.model.countDocuments({ questionId });
  }
}
