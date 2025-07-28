import { logger } from "@shared/monitoring/src/logger";
import { FilterQuery, SortOrder } from "mongoose";
import mongoose from "mongoose";
import { CommissionHistoryEntity, ICommissionHistoryEntity } from "../models/entity/commissionHistory.entity";

export class CommissionHistoryRepository {
  constructor(private readonly model = CommissionHistoryEntity) {}

  async create(data: Pick<ICommissionHistoryEntity,
    "userWallet" |
    "userId" |
    "chainId" |
    "tokenAddress" |
    "actionType" |
    "transactionHash" |
    "relatedUserWallet" |
    "relatedUserId"
  > & { amount: string }) {
    logger.debug(`Creating commission history: ${data.actionType} for user: ${data.userWallet}, amount: ${data.amount}`);

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
    logger.debug(`Finding commission history with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}