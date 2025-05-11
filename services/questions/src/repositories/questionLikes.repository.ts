import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  QuestionLikesEntity,
  IQuestionLikesEntity,
} from "../models/entity/questionLikes.entity";

export class QuestionLikesRepository {
  constructor(private readonly model = QuestionLikesEntity) {}

  async create(data: Pick<IQuestionLikesEntity, "userId"> & { questionId: string }) {
    logger.debug(`Creating like for question: ${data.questionId} by user: ${data.userId}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async delete(questionId: string, userId: string) {
    logger.debug(`Deleting like for question: ${questionId} by user: ${userId}`);
    const doc = await this.model.findOneAndDelete({ questionId, userId }).lean();

    if (!doc) {
      throw new NotFoundError("QuestionLike", `${questionId}:${userId}`);
    }

    return doc;
  }

  async exists(questionId: string, userId: string): Promise<boolean> {
    logger.debug(`Checking like existence for question: ${questionId} by user: ${userId}`);
    const doc = await this.model.findOne({ questionId, userId }).lean();
    return !!doc;
  }

  async findByQuestionId(
    questionId: Types.ObjectId | string,
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding likes for question: ${questionId}`);
    const docs = await this.model
      .find({ questionId })
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();

    return docs;
  }

  async findByQuestionIds(
    questionIds: (Types.ObjectId | string)[],
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0
  ) {
    const query: FilterQuery<typeof this.model> = {};

    if (questionIds.length === 1) {
      query.questionId = questionIds[0];
    } else if(questionIds.length > 1) {
      query.questionId = { $in: questionIds };
    }

    logger.debug(`Finding likes with query: ${JSON.stringify(query)}`);

    return await this.model
      .find(query)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }

  async findByUserId(
    userId: string,
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding likes by user: ${userId}`);
    const docs = await this.model
      .find({ userId })
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();

    return docs;
  }

  async countByQuestionId(questionId: Types.ObjectId | string): Promise<number> {
    logger.debug(`Counting likes for question: ${questionId}`);
    return await this.model.countDocuments({ questionId });
  }
}