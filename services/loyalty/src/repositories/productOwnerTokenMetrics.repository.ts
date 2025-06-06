import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  ProductOwnerTokenMetricsEntity,
  IProductOwnerTokenMetricsEntity,
} from "../models/entity/productOwnerTokenMetrics.entity";

export class ProductOwnerTokenMetricsRepository {
  constructor(private readonly model = ProductOwnerTokenMetricsEntity) { }

  async findById(id: string) {
    logger.debug(`Finding product owner token metrics by ID: ${id}`);
    const doc = await this.model.findById(id).lean();

    if (!doc) {
      throw new NotFoundError("ProductOwnerTokenMetrics", id);
    }

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding product owner token metrics with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }

  async upsert(userWallet: string, chainId: number, holdTokenAddress: string, data: Partial<Pick<IProductOwnerTokenMetricsEntity,
    | "ownerTotalFundsReturned"
    | "managerTotalFundsReturned"
    | "totalFundsWithdrawn"
  >>) {
    logger.debug(`Upserting product owner token metrics for wallet: ${userWallet}, chain: ${chainId}, token: ${holdTokenAddress}`);

    const doc = await this.model.findOneAndUpdate(
      { userWallet, chainId, holdTokenAddress },
      {
        $setOnInsert: {
          userWallet,
          chainId,
          holdTokenAddress,
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