import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder } from "mongoose";
import {
  CompanyEntity,
  ICompanyEntity,
} from "../models/entity/company.entity";

export class CompanyRepository {
  constructor(private readonly model = CompanyEntity) {}

  async create(data: Pick<ICompanyEntity, "name" | "description" | "ownerId">) {
    logger.debug(`Creating company: ${data.name}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(id: string, data: Partial<Pick<ICompanyEntity, "name" | "description">>) {
    logger.debug(`Updating company: ${id}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("Company", id);
    }

    return doc;
  }

  async delete(id: string) {
    logger.debug(`Deleting company: ${id}`);
    const doc = await this.model.findByIdAndDelete(id).lean();

    if (!doc) {
      throw new NotFoundError("Company", id);
    }

    return id;
  }

  async deleteMany(filter: FilterQuery<typeof this.model>) {
    logger.debug(`Deleting companies with filter: ${JSON.stringify(filter)}`);
    const result = await this.model.deleteMany(filter);
    return result.deletedCount;
  }

  async findById(id: string) {
    logger.debug(`Finding company by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Company", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit?: number,
    offset?: number
  ) {
    logger.debug(`Finding companies with filter: ${JSON.stringify(filter)}`);

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