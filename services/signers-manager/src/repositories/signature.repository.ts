import { AppError } from '@shared/errors/app-errors';
import type { FilterQuery, SortOrder } from 'mongoose';
import { SignatureEntity } from '../models/entity/signature.entity';
import type { ISignature } from '../models/entity/signature.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class SignatureRepository {
  constructor(private readonly model = SignatureEntity) {}

  @TraceDecorator()
  async create(data: Pick<ISignature, 'taskId' | 'signer' | 'signature'>) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({
        message: `Signature ${id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return doc;
  }

  @TraceDecorator()
  async findByTaskId(taskId: string, sort: { [key: string]: SortOrder } = { createdAt: 'asc' }) {
    const docs = await this.model.find({ taskId }).sort(sort).lean();

    return docs;
  }

  @TraceDecorator()
  async countByTaskId(taskId: string): Promise<number> {
    return this.model.countDocuments({ taskId });
  }

  @TraceDecorator()
  async findAll(
    filters: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    const docs = await this.model.find(filters).sort(sort).skip(offset).limit(limit).lean();

    return docs;
  }
}
