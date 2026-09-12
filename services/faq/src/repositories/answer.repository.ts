import { AppError } from '@shared/errors/app-errors';
import { type FilterQuery, type SortOrder, Types } from 'mongoose';
import { AnswerEntity, type IAnswerEntity } from '../models/entity/answer.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class AnswerRepository {
  constructor(private readonly model = AnswerEntity) {}

  @TraceDecorator()
  async create(
    data: { topicId: Types.ObjectId | string } & Pick<
      IAnswerEntity,
      'question' | 'answer' | 'ownerId' | 'ownerType' | 'creator' | 'parentId' | 'grandParentId'
    >,
  ) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async update(id: string, data: Partial<Pick<IAnswerEntity, 'question' | 'answer' | 'order'>>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new AppError({ message: `Answer ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  @TraceDecorator()
  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({ message: `Answer ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return id;
  }

  @TraceDecorator()
  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({ message: `Answer ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  @TraceDecorator()
  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { order: 'desc', createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    return await this.model.find(filter).sort(sort).skip(offset).limit(limit).lean();
  }
}
