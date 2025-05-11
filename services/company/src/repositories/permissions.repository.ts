import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  PermissionEntity,
  IPermissionEntity,
} from "../models/entity/permissions.entity";

export class PermissionRepository {
  constructor(private readonly model = PermissionEntity) { }

  async create(data: { companyId: Types.ObjectId | string, memberId: Types.ObjectId | string } & Pick<IPermissionEntity, "userId" | "permission" | "entity">) {
    logger.debug(`Creating permission: ${data.permission} for user ${data.userId} in company ${data.companyId}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async delete(id: string) {
    logger.debug(`Deleting permission: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("Permission", id);
    }

    return id;
  }

  async deleteMany(filter: FilterQuery<typeof this.model>) {
    logger.debug(`Deleting permissions with filter: ${JSON.stringify(filter)}`);
    const result = await this.model.deleteMany(filter);
    return result.deletedCount;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit?: number,
    offset?: number
  ) {
    logger.debug(`Finding permissions with filter: ${JSON.stringify(filter)}`);

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