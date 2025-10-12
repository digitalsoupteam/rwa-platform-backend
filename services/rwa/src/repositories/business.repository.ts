import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder } from "mongoose";
import { BusinessEntity, IBusinessEntity } from "../models/entity/business.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class BusinessRepository {
  constructor(private readonly model = BusinessEntity) { }

  async createBusiness(data: Pick<IBusinessEntity,
    "ownerId" |
    "ownerType" |
    "name" |
    "chainId"
  > & Partial<Pick<IBusinessEntity,
    "description" |
    "tags" |
    "image"
  >>) {
    logger.debug(`Creating business: ${JSON.stringify(data)}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async updateBusiness(id: string, data: Partial<Pick<IBusinessEntity,
    "chainId" |
    "ownerWallet" |
    "name" |
    "tokenAddress" |
    "description" |
    "tags" |
    "riskScore" |
    "approvalSignaturesTaskId" |
    "approvalSignaturesTaskExpired" |
    "paused"
  >>) {
    logger.debug(`Updating business fields: ${JSON.stringify(data)}`);
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).lean();

    if (!doc) {
      throw new NotFoundError("Business", id);
    }

    return doc;
  }

  async findById(id: string) {
    logger.debug(`Finding business by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("Business", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding businesses with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}