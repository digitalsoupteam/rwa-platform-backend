import { logger } from "@shared/monitoring/src/logger";
import { TopicRepository } from "../repositories/topic.repository";
import { AnswerRepository } from "../repositories/answer.repository";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class FaqService {
  constructor(
    private readonly topicRepository: TopicRepository,
    private readonly answerRepository: AnswerRepository
  ) {}

  /**
   * Creates a new topic
   */
  async createTopic(data: {
    name: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
  }) {
    logger.debug("Creating new topic", { name: data.name });
    
    const topic = await this.topicRepository.create(data);

    return {
      id: topic._id.toString(),
      name: topic.name,
      ownerId: topic.ownerId,
      ownerType: topic.ownerType,
      creator: topic.creator,
      parentId: topic.parentId,
      grandParentId: topic.grandParentId,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
    };
  }

  /**
   * Updates topic name
   */
  async updateTopic(params: { id: string, updateData: { name: string } }) {
    logger.debug("Updating topic", params);
    
    const topic = await this.topicRepository.update(params.id, params.updateData);

    return {
      id: topic._id.toString(),
      name: topic.name,
      ownerId: topic.ownerId,
      ownerType: topic.ownerType,
      creator: topic.creator,
      parentId: topic.parentId,
      grandParentId: topic.grandParentId,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
    };
  }

  /**
   * Deletes a topic and all its answers
   */
  async deleteTopic(id: string) {
    logger.debug("Deleting topic and its answers", { id });
    
    // First delete all answers in the topic
    const answers = await this.answerRepository.findAll({ topicId: id });
    for (const answer of answers) {
      await this.answerRepository.delete(answer._id.toString());
    }

    // Then delete the topic itself
    await this.topicRepository.delete(id);

    return { id };
  }

  /**
   * Gets topic by ID
   */
  async getTopic(id: string) {
    logger.debug("Getting topic", { id });
    
    const topic = await this.topicRepository.findById(id);

    return {
      id: topic._id.toString(),
      name: topic.name,
      ownerId: topic.ownerId,
      ownerType: topic.ownerType,
      creator: topic.creator,
      parentId: topic.parentId,
      grandParentId: topic.grandParentId,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
    };
  }

  /**
   * Gets topics list with filters, pagination and sorting
   */
  async getTopics(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting topics list", params);
    
    const topics = await this.topicRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return topics.map(topic => ({
      id: topic._id.toString(),
      name: topic.name,
      ownerId: topic.ownerId,
      ownerType: topic.ownerType,
      creator: topic.creator,
      parentId: topic.parentId,
      grandParentId: topic.grandParentId,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
    }));
  }

  /**
   * Creates a new answer in a topic
   */
  async createAnswer(data: {
    topicId: string;
    question: string;
    answer: string;
    order?: number;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
  }) {
    logger.debug("Creating new answer", { question: data.question });
    
    const answer = await this.answerRepository.create(data);

    return {
      id: answer._id.toString(),
      topicId: answer.topicId.toString(),
      question: answer.question,
      answer: answer.answer,
      order: answer.order,
      ownerId: answer.ownerId,
      ownerType: answer.ownerType,
      creator: answer.creator,
      parentId: answer.parentId,
      grandParentId: answer.grandParentId,
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt,
    };
  }

  /**
   * Updates answer
   */
  async updateAnswer(params: {
    id: string;
    updateData: {
      question?: string;
      answer?: string;
      order?: number;
    }
  }) {
    logger.debug("Updating answer", params);
    
    const answer = await this.answerRepository.update(params.id, params.updateData);

    return {
      id: answer._id.toString(),
      topicId: answer.topicId.toString(),
      question: answer.question,
      answer: answer.answer,
      order: answer.order,
      ownerId: answer.ownerId,
      ownerType: answer.ownerType,
      creator: answer.creator,
      parentId: answer.parentId,
      grandParentId: answer.grandParentId,
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt,
    };
  }

  /**
   * Deletes answer
   */
  async deleteAnswer(id: string) {
    logger.debug("Deleting answer", { id });
    await this.answerRepository.delete(id);
    return { id };
  }

  /**
   * Gets answer by ID
   */
  async getAnswer(id: string) {
    logger.debug("Getting answer", { id });
    
    const answer = await this.answerRepository.findById(id);

    return {
      id: answer._id.toString(),
      topicId: answer.topicId.toString(),
      question: answer.question,
      answer: answer.answer,
      order: answer.order,
      ownerId: answer.ownerId,
      ownerType: answer.ownerType,
      creator: answer.creator,
      parentId: answer.parentId,
      grandParentId: answer.grandParentId,
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt,
    };
  }

  /**
   * Gets answers list with filters, pagination and sorting
   */
  async getAnswers(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting answers list", params);
    
    const answers = await this.answerRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return answers.map(answer => ({
      id: answer._id.toString(),
      topicId: answer.topicId.toString(),
      question: answer.question,
      answer: answer.answer,
      order: answer.order,
      ownerId: answer.ownerId,
      ownerType: answer.ownerType,
      creator: answer.creator,
      parentId: answer.parentId,
      grandParentId: answer.grandParentId,
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt,
    }));
  }
}