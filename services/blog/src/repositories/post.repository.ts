import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  PostEntity,
  IPostEntity,
} from "../models/entity/post.entity";

export class PostRepository {
  constructor(private readonly model = PostEntity) { }

  async create(data: { blogId: Types.ObjectId | string }
    & Pick<IPostEntity, "title" | "content" | "ownerId" | "ownerType" | "creator" | "parentId" | "grandParentId">
    & Partial<Pick<IPostEntity, "images" | "documents">>
  ) {
    logger.debug(`Creating post: ${data.title}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<Pick<IPostEntity, "title" | "content" | "images" | "documents">>) {
    logger.debug(`Updating post: ${id}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("Post", id);
    }

    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting post: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("Post", id);
    }

    return id;
  }

  async findById(id: string) {
    logger.debug(`Finding post by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Post", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {

    logger.debug(`Finding posts with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}