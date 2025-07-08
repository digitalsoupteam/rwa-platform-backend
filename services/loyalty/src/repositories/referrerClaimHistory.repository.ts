import { logger } from "@shared/monitoring/src/logger";
import { FilterQuery, SortOrder } from "mongoose";
import mongoose from "mongoose";
import { ReferrerClaimHistoryEntity, IReferrerClaimHistoryEntity } from "../models/entity/referrerClaimHistory.entity";

export class ReferrerClaimHistoryRepository {
  constructor(private readonly model = ReferrerClaimHistoryEntity) {}

  async create(data: Pick<IReferrerClaimHistoryEntity,
    "referrerWallet" |
    "chainId" |
    "tokenAddress" |
    "referralWallet" |
    "transactionHash" |
    "logIndex" |
    "blockNumber"
  > & { amount: string }) {
    logger.debug(`Creating referrer claim history: ${data.transactionHash}:${data.logIndex} for referrer: ${data.referrerWallet}`);

    const createData = {
      ...data,
      amount: mongoose.Types.Decimal128.fromString(data.amount)
    };

    const doc = await this.model.create(createData);
    return doc.toObject();
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding referrer claim history with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}