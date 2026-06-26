import { TopicRepository } from '../repositories/topic.repository';
import { QuestionRepository } from '../repositories/question.repository';
import type { SortOrder } from 'mongoose';
import { QuestionLikesRepository } from '../repositories/questionLikes.repository';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';

export class QuestionsService {
  constructor(
    private readonly topicRepository: TopicRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly questionLikesRepository: QuestionLikesRepository,
  ) {}

  /**
   * Toggles like status for a question
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['data'] })
  async toggleLike(data: { questionId: string; userId: string }) {
    setSpanAttributes({ userId: data.userId, questionId: data.questionId });
    const exists = await this.questionLikesRepository.exists(data.questionId, data.userId);

    if (exists) {
      // Remove like and decrease counter
      await this.questionLikesRepository.delete(data.questionId, data.userId);
      await this.questionRepository.decrementLikes(data.questionId);
      return { liked: false };
    } else {
      // Add like and increase counter
      await this.questionLikesRepository.create({
        questionId: data.questionId,
        userId: data.userId,
      });
      await this.questionRepository.incrementLikes(data.questionId);
      return { liked: true };
    }
  }

  /**
   * Creates a new topic
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['data'] })
  async createTopic(data: {
    name: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
  }) {
    setSpanAttributes({});
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['params'] })
  async updateTopic(params: { id: string; updateData: { name: string } }) {
    setSpanAttributes({});
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
   * Deletes a topic and all its questions
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async deleteTopic(id: string) {
    setSpanAttributes({});
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async getTopic(id: string) {
    setSpanAttributes({});
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['params'] })
  async getTopics(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    setSpanAttributes({});
    const topics = await this.topicRepository.findAll(params.filter, params.sort, params.limit, params.offset);

    return topics.map((topic) => ({
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
   * Creates a new question in a topic
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['data'] })
  async createQuestion(data: {
    topicId: string;
    text: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
  }) {
    setSpanAttributes({ topicId: data.topicId });
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['params'] })
  async updateQuestionText(params: {
    id: string;
    updateData: {
      text: string;
    };
  }) {
    setSpanAttributes({});
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['params'] })
  async updateAnswer(params: {
    id: string;
    updateData: {
      text: string;
    };
  }) {
    setSpanAttributes({});
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['data'] })
  async createAnswer(data: { id: string; userId: string; text: string }) {
    setSpanAttributes({ userId: data.userId });
    const question = await this.questionRepository.createAnswer(data.id, {
      userId: data.userId,
      text: data.text,
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async deleteQuestion(id: string) {
    setSpanAttributes({});
    await this.questionRepository.delete(id);
    return { id };
  }

  /**
   * Gets question by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async getQuestion(id: string) {
    setSpanAttributes({});
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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['params'] })
  async getQuestions(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    setSpanAttributes({});
    const questions = await this.questionRepository.findAll(params.filter, params.sort, params.limit, params.offset);

    return questions.map((question) => ({
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
