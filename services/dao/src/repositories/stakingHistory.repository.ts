import { logger } from "@shared/monitoring/src/logger";
import { FilterQuery, SortOrder } from "mongoose";
import mongoose from "mongoose";
import { StakingHistoryEntity, IStakingHistoryEntity } from "../models/entity/stakingHistory.entity";

export class StakingHistoryRepository {
  constructor(private readonly model = StakingHistoryEntity) {}

  async create(data: Pick<IStakingHistoryEntity,
    "staker" |
    "operation" |
    "chainId" |
    "transactionHash" |
    "logIndex"
  > & {amount: string}) {
    logger.debug(`Creating staking history: ${data.operation} ${data.amount} for staker: ${data.staker}`);

    const doc = await this.model.create({
      ...data,
      amount: mongoose.Types.Decimal128.fromString(data.amount)
    });
    return doc.toObject();
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding staking history with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}