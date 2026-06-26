import { AppError } from '@shared/errors/app-errors';
import type { FilterQuery, SortOrder, Types } from 'mongoose';
import { MemberEntity } from '../models/entity/members.entity';
import type { IMemberEntity } from '../models/entity/members.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class MemberRepository {
  constructor(private readonly model = MemberEntity) {}

  @TraceDecorator()
  async create(data: { companyId: Types.ObjectId | string } & Pick<IMemberEntity, 'userId' | 'name'>) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async update(id: string, data: Partial<Pick<IMemberEntity, 'name'>>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new AppError({ message: `Member ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  @TraceDecorator()
  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({ message: `Member ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return id;
  }

  @TraceDecorator()
  async deleteMany(filter: FilterQuery<typeof this.model>) {
    const result = await this.model.deleteMany(filter);
    return result.deletedCount;
  }

  @TraceDecorator()
  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({ message: `Member ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  @TraceDecorator()
  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit?: number,
    offset?: number,
  ) {
    let query = this.model.find(filter).sort(sort);

    if (typeof offset === 'number') {
      query = query.skip(offset);
    }

    if (typeof limit === 'number') {
      query = query.limit(limit);
    }

    return await query.lean();
  }
}
