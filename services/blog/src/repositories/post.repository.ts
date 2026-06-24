import { AppError } from "@shared/errors/app-errors";
import type { FilterQuery, SortOrder, Types } from "mongoose";
import {
  PostEntity,
} from "../models/entity/post.entity";
import type { IPostEntity } from "../models/entity/post.entity";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";


export class PostRepository {
  constructor(private readonly model = PostEntity) { }

  @TraceDecorator()
  async create(data: { blogId: Types.ObjectId | string }
    & Pick<IPostEntity, "title" | "content" | "ownerId" | "ownerType" | "creator" | "parentId" | "grandParentId">
    & Partial<Pick<IPostEntity, "images" | "documents">>
  ) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async update(id: string, data: Partial<Pick<IPostEntity, "title" | "content" | "images" | "documents">>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new AppError({ message: `Post ${id} not found`, statusCode: 404, code: "NOT_FOUND" });
    }

    return doc;
  }

  @TraceDecorator()
  async delete(id: string) {
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new AppError({ message: `Post ${id} not found`, statusCode: 404, code: "NOT_FOUND" });
    }

    return id;
  }

  @TraceDecorator()
  async findById(id: string) {
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new AppError({ message: `Post ${id} not found`, statusCode: 404, code: "NOT_FOUND" });
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
