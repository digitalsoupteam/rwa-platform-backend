import { AppError } from '@shared/errors/app-errors';
import type { FilterQuery, SortOrder } from 'mongoose';
import { ExampleEntity } from '../models/entity/example.entity';
import type { IExampleEntity } from '../models/entity/example.entity';
import { TracingDecoratorClass } from '@shared/monitoring/src/tracingDecoratorClass';

@TracingDecoratorClass()
export class ExampleRepository {
  constructor(private readonly model = ExampleEntity) {}

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({ message: `Example ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    return await this.model.find(filter).sort(sort).skip(offset).limit(limit).lean();
  }

  async create(
    data: Pick<IExampleEntity, 'name' | 'ownerId' | 'ownerType' | 'creator' | 'parentId' | 'grandParentId'>,
  ) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<Pick<IExampleEntity, 'name'>>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new AppError({ message: `Example ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({ message: `Example ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return id;
  }
}
