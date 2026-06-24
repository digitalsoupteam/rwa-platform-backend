import { AppError } from "@shared/errors/app-errors";
import { type FilterQuery, type SortOrder } from "mongoose";
import {
  GalleryEntity,
  type IGalleryEntity,
} from "../models/entity/gallery.entity";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";


export class GalleryRepository {
  constructor(private readonly model = GalleryEntity) {}

  @TraceDecorator()
  async create(data: Pick<IGalleryEntity, "name" | "ownerId" | "ownerType" | "creator" | "parentId" | "grandParentId">) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async update(id: string, data: Partial<Pick<IGalleryEntity, "name">>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new AppError({ message: `Gallery ${id} not found`, statusCode: 404, code: "NOT_FOUND" });
    }

    return doc;
  }

  @TraceDecorator()
  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({ message: `Gallery ${id} not found`, statusCode: 404, code: "NOT_FOUND" });
    }

    return id;
  }

  @TraceDecorator()
  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({ message: `Gallery ${id} not found`, statusCode: 404, code: "NOT_FOUND" });
    }

    return doc;
  }

  @TraceDecorator()
  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}
