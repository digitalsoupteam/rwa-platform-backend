import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  MemberEntity,
  IMemberEntity,
} from "../models/entity/members.entity";

export class MemberRepository {
  constructor(private readonly model = MemberEntity) {}

  async create(data: {companyId: Types.ObjectId | string} & Pick<IMemberEntity, "userId" | "name">) {
    logger.debug(`Creating member: ${data.name} for company ${data.companyId}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<Pick<IMemberEntity, "name">>) {
    logger.debug(`Updating member: ${id}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("Member", id);
    }

    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting member: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("Member", id);
    }

    return id;
  }

  async deleteMany(filter: FilterQuery<typeof this.model>) {
    logger.debug(`Deleting members with filter: ${JSON.stringify(filter)}`);
    const result = await this.model.deleteMany(filter);
    return result.deletedCount;
  }

  async findById(id: string) {
    logger.debug(`Finding member by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Member", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit?: number,
    offset?: number
  ) {
    logger.debug(`Finding members with filter: ${JSON.stringify(filter)}`);

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