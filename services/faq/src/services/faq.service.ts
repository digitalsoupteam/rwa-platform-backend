import { TopicRepository } from '../repositories/topic.repository';
import { AnswerRepository } from '../repositories/answer.repository';
import type { SortOrder } from 'mongoose';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';

export class FaqService {
  constructor(
    private readonly topicRepository: TopicRepository,
    private readonly answerRepository: AnswerRepository,
  ) {}

  /**
   * Creates a new topic
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['name'] })
  async createTopic(data: {
    name: string;
    ownerId: string;
    ownerType: string;
    creator: string;
    parentId: string;
    grandParentId: string;
  }) {
    setSpanAttributes({
      userId: data.creator,
      entityId: data.parentId,
    });

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
  @LogDecorator({ args: ['id'] })
  async updateTopic(params: { id: string; updateData: { name: string } }) {
    setSpanAttributes({ entityId: params.id });

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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async deleteTopic(id: string) {
    setSpanAttributes({ entityId: id });

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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async getTopic(id: string) {
    setSpanAttributes({ entityId: id });

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
  @LogDecorator({ args: ['filter'] })
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
   * Creates a new answer in a topic
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['question'] })
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
    setSpanAttributes({
      topicId: data.topicId,
      userId: data.creator,
    });

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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async updateAnswer(params: {
    id: string;
    updateData: {
      question?: string;
      answer?: string;
      order?: number;
    };
  }) {
    setSpanAttributes({ entityId: params.id });

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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async deleteAnswer(id: string) {
    setSpanAttributes({ entityId: id });
    await this.answerRepository.delete(id);
    return { id };
  }

  /**
   * Gets answer by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['id'] })
  async getAnswer(id: string) {
    setSpanAttributes({ entityId: id });

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
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['filter'] })
  async getAnswers(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    setSpanAttributes({});

    const answers = await this.answerRepository.findAll(params.filter, params.sort, params.limit, params.offset);

    return answers.map((answer) => ({
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
