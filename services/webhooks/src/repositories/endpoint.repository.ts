import { AppError } from '@shared/errors/app-errors';
import { EndpointEntity } from '../models/entity/endpoint.entity';
import type { IEndpointEntity } from '../models/entity/endpoint.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class EndpointRepository {
  constructor(private readonly model = EndpointEntity) {}

  @TraceDecorator()
  async createEndpoint(
    data: Pick<IEndpointEntity, 'userId' | 'wallet' | 'url' | 'secret' | 'events'> &
      Partial<Pick<IEndpointEntity, 'description' | 'rateLimitPerMinute'>>,
  ) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({ message: `Webhook endpoint ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  @TraceDecorator()
  async findAll(filters: { userId: string }) {
    return await this.model.find(filters).lean();
  }

  @TraceDecorator()
  async findByEvents(eventType: string) {
    return await this.model.find({ events: eventType, active: true }).lean();
  }

  @TraceDecorator()
  async updateEndpoint(
    id: string,
    data: Partial<
      Pick<
        IEndpointEntity,
        'url' | 'secret' | 'events' | 'description' | 'active' | 'rateLimitPerMinute' | 'consecutiveFailures'
      >
    >,
  ) {
    const doc = await this.model
      .findByIdAndUpdate(id, { $set: { ...data, updatedAt: Math.floor(Date.now() / 1000) } }, { new: true })
      .lean();

    if (!doc) {
      throw new AppError({ message: `Webhook endpoint ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  @TraceDecorator()
  async deleteEndpoint(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({ message: `Webhook endpoint ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  @TraceDecorator()
  async countByUser(userId: string) {
    return await this.model.countDocuments({ userId });
  }
}
