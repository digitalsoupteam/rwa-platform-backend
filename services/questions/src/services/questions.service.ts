import { logger } from "@shared/monitoring/src/logger";
import { TopicRepository } from "../repositories/topic.repository";
import { QuestionRepository } from "../repositories/question.repository";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { QuestionLikesRepository } from "../repositories/questionLikes.repository";

export class QuestionsService {
  constructor(
    private readonly topicRepository: TopicRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly questionLikesRepository: QuestionLikesRepository
  ) {}

  /**
   * Toggles like status for a question
   */
  async toggleLike(data: {
    questionId: string;
    userId: string;
  }) {
    logger.debug("Toggling question like", {
      questionId: data.questionId,
      userId: data.userId
    });
    
    const exists = await this.questionLikesRepository.exists(
      data.questionId,
      data.userId
    );

    if (exists) {
      // Remove like and decrease counter
      await this.questionLikesRepository.delete(data.questionId, data.userId);
      await this.questionRepository.decrementLikes(data.questionId);
      return { liked: false };
    } else {
      // Add like and increase counter
      await this.questionLikesRepository.create({
        questionId: data.questionId,
        userId: data.userId
      });
      await this.questionRepository.incrementLikes(data.questionId);
      return { liked: true };
    }
  }

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
      grandParentId: topic.grandParentId
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
      grandParentId: topic.grandParentId
    };
  }

  /**
   * Deletes a topic and all its questions
   */
  async deleteTopic(id: string) {
    logger.debug("Deleting topic and its content", { id });
    
    // First get all questions in the topic
    const questions = await this.questionRepository.findAll({ topicIds: [id] });
    
    // Delete all questions
    for (const question of questions) {
      await this.questionRepository.delete(question._id.toString());
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
      grandParentId: topic.grandParentId
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
      grandParentId: topic.grandParentId
    }));
  }

  /**
   * Creates a new question in a topic
   */
  async createQuestion(data: {
    topicId: string;
    text: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
  }) {
    logger.debug("Creating new question", { text: data.text });
    
    const question = await this.questionRepository.create(data);

    return {
      id: question._id.toString(),
      topicId: question.topicId.toString(),
      text: question.text,
      answered: question.answered,
      answer: question.answer ?? undefined,
      likesCount: question.likesCount,
      ownerId: question.ownerId,
      ownerType: question.ownerType,
      creator: question.creator,
      parentId: question.parentId,
      grandParentId: question.grandParentId,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  /**
   * Updates question text
   */
  async updateQuestionText(params: {
    id: string;
    updateData: {
      text: string;
    }
  }) {
    logger.debug("Updating question text", params);
    
    const question = await this.questionRepository.updateText(params.id, params.updateData.text);

    return {
      id: question._id.toString(),
      topicId: question.topicId.toString(),
      text: question.text,
      answered: question.answered,
      answer: question.answer ?? undefined,
      likesCount: question.likesCount,
      ownerId: question.ownerId,
      ownerType: question.ownerType,
      creator: question.creator,
      parentId: question.parentId,
      grandParentId: question.grandParentId,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  /**
   * Updates question answer
   */
  async updateAnswer(params: {
    id: string;
    updateData: {
      text: string;
    }
  }) {
    logger.debug("Updating question answer", params);
    
    const question = await this.questionRepository.updateAnswerText(params.id, params.updateData.text);

    return {
      id: question._id.toString(),
      topicId: question.topicId.toString(),
      text: question.text,
      answered: question.answered,
      answer: question.answer!,
      likesCount: question.likesCount,
      ownerId: question.ownerId,
      ownerType: question.ownerType,
      creator: question.creator,
      parentId: question.parentId,
      grandParentId: question.grandParentId,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  /**
   * Creates answer for question
   */
  async createAnswer(data: {
    id: string;
    userId: string;
    text: string;
  }) {
    logger.debug("Creating question answer", { id: data.id });
    
    const question = await this.questionRepository.createAnswer(data.id, {
      userId: data.userId,
      text: data.text
    });

    return {
      id: question._id.toString(),
      topicId: question.topicId.toString(),
      text: question.text,
      answered: question.answered,
      answer: question.answer!,
      likesCount: question.likesCount,
      ownerId: question.ownerId,
      ownerType: question.ownerType,
      creator: question.creator,
      parentId: question.parentId,
      grandParentId: question.grandParentId,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  /**
   * Deletes question
   */
  async deleteQuestion(id: string) {
    logger.debug("Deleting question", { id });
    await this.questionRepository.delete(id);
    return { id };
  }

  /**
   * Gets question by ID
   */
  async getQuestion(id: string) {
    logger.debug("Getting question", { id });
    
    const question = await this.questionRepository.findById(id);

    return {
      id: question._id.toString(),
      topicId: question.topicId.toString(),
      text: question.text,
      answered: question.answered,
      answer: question.answer ?? undefined,
      likesCount: question.likesCount,
      ownerId: question.ownerId,
      ownerType: question.ownerType,
      creator: question.creator,
      parentId: question.parentId,
      grandParentId: question.grandParentId,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  /**
   * Gets questions list with filters, pagination and sorting
   */
  async getQuestions(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug("Getting questions list", params);
    
    const questions = await this.questionRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return questions.map(question => ({
      id: question._id.toString(),
      topicId: question.topicId.toString(),
      text: question.text,
      answered: question.answered,
      answer: question.answer ?? undefined,
      likesCount: question.likesCount,
      ownerId: question.ownerId,
      ownerType: question.ownerType,
      creator: question.creator,
      parentId: question.parentId,
      grandParentId: question.grandParentId,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    }));
  }
}