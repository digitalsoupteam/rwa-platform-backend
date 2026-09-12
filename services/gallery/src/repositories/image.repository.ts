import { AppError } from '@shared/errors/app-errors';
import { type FilterQuery, type SortOrder, Types } from 'mongoose';
import { ImageEntity, type IImageEntity } from '../models/entity/image.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class ImageRepository {
  constructor(private readonly model = ImageEntity) {}

  @TraceDecorator()
  async create(
    data: { galleryId: Types.ObjectId | string } & Pick<
      IImageEntity,
      | 'name'
      | 'description'
      | 'fileId'
      | 'path'
      | 'mimeType'
      | 'size'
      | 'ownerId'
      | 'ownerType'
      | 'creator'
      | 'parentId'
      | 'grandParentId'
    >,
  ) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async update(id: string, data: Partial<Pick<IImageEntity, 'name' | 'description'>>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new AppError({ message: `Image ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  @TraceDecorator()
  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({ message: `Image ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return id;
  }

  @TraceDecorator()
  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({ message: `Image ${id} not found`, statusCode: 404, code: 'NOT_FOUND' });
    }

    return doc;
  }

  @TraceDecorator()
  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    return await this.model.find(filter).sort(sort).skip(offset).limit(limit).lean();
  }
}
