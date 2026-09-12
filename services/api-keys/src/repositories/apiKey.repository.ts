import { AppError } from '@shared/errors/app-errors';
import { ApiKeyEntity } from '../models/entity/apiKey.entity';
import type { IApiKeyEntity } from '../models/entity/apiKey.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class ApiKeyRepository {
  constructor(private readonly model = ApiKeyEntity) {}

  @TraceDecorator()
  async create(data: Pick<IApiKeyEntity, 'userId' | 'wallet' | 'name' | 'keyHash' | 'prefix'>) {
    const doc = await this.model.create(data);

    return doc.toObject();
  }

  @TraceDecorator()
  async findById(params: { id: string; userId: string }) {
    const doc = await this.model.findOne({ _id: params.id, userId: params.userId }).lean();

    if (!doc) {
      throw new AppError({
        message: `ApiKey ${params.id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }

  @TraceDecorator()
  async findAll(filters: { userId: string }) {
    return await this.model.find(filters).select('-keyHash').lean();
  }

  @TraceDecorator()
  async delete(params: { id: string; userId: string }) {
    const doc = await this.model.findOneAndDelete({ _id: params.id, userId: params.userId }).lean();

    if (!doc) {
      throw new AppError({
        message: `ApiKey ${params.id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }

  @TraceDecorator()
  async update(params: { id: string; userId: string; name: string }) {
    const doc = await this.model
      .findOneAndUpdate({ _id: params.id, userId: params.userId }, { name: params.name }, { new: true, lean: true })
      .select('-keyHash');

    if (!doc) {
      throw new AppError({
        message: `ApiKey ${params.id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }

  @TraceDecorator()
  async findByKeyHash(keyHash: string) {
    const doc = await this.model.findOne({ keyHash }).lean();

    if (!doc) {
      throw new AppError({
        message: 'ApiKey not found',
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }
}
