import { AppError } from '@shared/errors/app-errors';
import { SampleEntity } from '../models/entity/sample.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class SampleRepository {
  constructor(private readonly model = SampleEntity) {}

  @TraceDecorator()
  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({ message: `Sample ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  @TraceDecorator()
  async create(data: { name: string }) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async findAll() {
    return await this.model.find().lean();
  }

  @TraceDecorator()
  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({ message: `Sample ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return id;
  }
}
