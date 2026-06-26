import { AppError } from '@shared/errors/app-errors';
import { Types } from 'mongoose';
import type { FilterQuery, SortOrder } from 'mongoose';
import { QuestionEntity, type IQuestionEntity } from '../models/entity/question.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class QuestionRepository {
  constructor(private readonly model = QuestionEntity) {}

  @TraceDecorator()
  async create(
    data: { topicId: Types.ObjectId | string } & Pick<
      IQuestionEntity,
      'text' | 'ownerId' | 'ownerType' | 'creator' | 'parentId' | 'grandParentId'
    >,
  ) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async updateText(id: string, text: string) {
    const doc = await this.model.findByIdAndUpdate(id, { text }, { new: true }).lean();

    if (!doc) {
      throw new AppError({
        message: `Question ${id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }

  @TraceDecorator()
  async updateAnswerText(id: string, text: string) {
    const doc = await this.model
      .findByIdAndUpdate(
        id,
        {
          'answer.text': text,
          'answer.updatedAt': Math.floor(Date.now() / 1000),
          answered: true,
        },
        { new: true },
      )
      .lean();

    if (!doc) {
      throw new AppError({
        message: `Question ${id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }

  @TraceDecorator()
  async createAnswer(id: string, data: { userId: string; text: string }) {
    const now = Math.floor(Date.now() / 1000);
    const doc = await this.model
      .findByIdAndUpdate(
        id,
        {
          answer: {
            userId: data.userId,
            text: data.text,
            createdAt: now,
            updatedAt: now,
          },
          answered: true,
        },
        { new: true },
      )
      .lean();

    if (!doc) {
      throw new AppError({
        message: `Question ${id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }

  @TraceDecorator()
  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({
        message: `Question ${id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return id;
  }

  @TraceDecorator()
  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({
        message: `Question ${id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }

  @TraceDecorator()
  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    return await this.model.find(filter).sort(sort).skip(offset).limit(limit).lean();
  }

  /**
   * Increment likes count for a question
   */
  @TraceDecorator()
  async incrementLikes(id: string) {
    const doc = await this.model.findByIdAndUpdate(id, { $inc: { likesCount: 1 } }, { new: true }).lean();

    if (!doc) {
      throw new AppError({
        message: `Question ${id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }

  /**
   * Decrement likes count for a question
   */
  @TraceDecorator()
  async decrementLikes(id: string) {
    const doc = await this.model.findByIdAndUpdate(id, { $inc: { likesCount: -1 } }, { new: true }).lean();

    if (!doc) {
      throw new AppError({
        message: `Question ${id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }
}
