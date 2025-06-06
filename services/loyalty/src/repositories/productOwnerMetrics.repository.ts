import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  ProductOwnerMetricsEntity,
  IProductOwnerMetricsEntity,
} from "../models/entity/productOwnerMetrics.entity";

export class ProductOwnerMetricsRepository {
  constructor(private readonly model = ProductOwnerMetricsEntity) { }

  async findById(id: string) {
    logger.debug(`Finding product owner metrics by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("ProductOwnerMetrics", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding product owner metrics with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }

  async upsert(userWallet: string, chainId: number, data: Partial<Pick<IProductOwnerMetricsEntity,
    | "businessesCreated"
    | "poolsCreated"
    | "businessesDeployed"
    | "poolsDeployed"
    | "targetReachedPools"
    | "fullyReturnedPools"
    | "poolsReturnCalled"
    | "poolsFullyReturnCalled"
    | "incomingTranchesCount"
    | "outgoingTranchesCount"
  >>) {
    logger.debug(`Upserting product owner metrics for wallet: ${userWallet}`);

    const doc = await this.model.findOneAndUpdate(
      { userWallet },
      {
        $setOnInsert: {
          userWallet,
        },
        $inc: data,
      },
      {
        new: true,
        upsert: true,
        lean: true
      }
    );

    return doc;
  }
}