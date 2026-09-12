import { AppError } from '@shared/errors/app-errors';
import type { FilterQuery, SortOrder, Types } from 'mongoose';
import { PermissionEntity } from '../models/entity/permissions.entity';
import type { IPermissionEntity } from '../models/entity/permissions.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class PermissionRepository {
  constructor(private readonly model = PermissionEntity) {}

  @TraceDecorator()
  async create(
    data: { companyId: Types.ObjectId | string; memberId: Types.ObjectId | string } & Pick<
      IPermissionEntity,
      'userId' | 'permission' | 'entity'
    >,
  ) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({
        message: `Permission ${id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return id;
  }

  @TraceDecorator()
  async deleteMany(filter: FilterQuery<typeof this.model>) {
    const result = await this.model.deleteMany(filter);
    return result.deletedCount;
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
