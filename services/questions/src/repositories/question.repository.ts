import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  QuestionEntity,
  IQuestionEntity,
} from "../models/entity/question.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class QuestionRepository {
  constructor(private readonly model = QuestionEntity) {}

  async create(data: {topicId: Types.ObjectId | string} & Pick<IQuestionEntity, "text" | "ownerId" | "ownerType" | "creator" | "parentId" | "grandParentId">) {
    logger.debug(`Creating question: ${data.text}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async updateText(id: string, text: string) {
    logger.debug(`Updating question text: ${id}`);
    const doc = await this.model.findByIdAndUpdate(
      id,
      { text },
      { new: true }
    ).lean();

    if (!doc) {
      throw new NotFoundError("Question", id);
    }

    return doc;
  }

  async updateAnswerText(id: string, text: string) {
    logger.debug(`Updating answer text: ${id}`);
    const doc = await this.model.findByIdAndUpdate(
      id,
      { 
        'answer.text': text,
        'answer.updatedAt': Math.floor(Date.now() / 1000),
        answered: true
      },
      { new: true }
    ).lean();

    if (!doc) {
      throw new NotFoundError("Question", id);
    }

    return doc;
  }

  async createAnswer(id: string, data: {userId: string, text: string}) {
    logger.debug(`Creating answer: ${id}`);
    const now = Math.floor(Date.now() / 1000);
    const doc = await this.model.findByIdAndUpdate(
      id,
      {
        answer: {
          userId: data.userId,
          text: data.text,
          createdAt: now,
          updatedAt: now
        },
        answered: true
      },
      { new: true }
    ).lean();

    if (!doc) {
      throw new NotFoundError("Question", id);
    }

    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting question: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("Question", id);
    }

    return id;
  }

  async findById(id: string) {
    logger.debug(`Finding question by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Question", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {

    logger.debug(`Finding questions with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }

  /**
   * Increment likes count for a question
   */
  async incrementLikes(id: string) {
    logger.debug(`Incrementing likes for question: ${id}`);
    const doc = await this.model.findByIdAndUpdate(
      id,
      { $inc: { likesCount: 1 } },
      { new: true }
    ).lean();

    if (!doc) {
      throw new NotFoundError("Question", id);
    }

    return doc;
  }

  /**
   * Decrement likes count for a question
   */
  async decrementLikes(id: string) {
    logger.debug(`Decrementing likes for question: ${id}`);
    const doc = await this.model.findByIdAndUpdate(
      id,
      { $inc: { likesCount: -1 } },
      { new: true }
    ).lean();

    if (!doc) {
      throw new NotFoundError("Question", id);
    }

    return doc;
  }
}