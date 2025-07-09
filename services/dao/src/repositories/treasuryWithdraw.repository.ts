import { logger } from "@shared/monitoring/src/logger";
import { FilterQuery, SortOrder } from "mongoose";
import mongoose from "mongoose";
import { TreasuryWithdrawEntity, ITreasuryWithdrawEntity } from "../models/entity/treasuryWithdraw.entity";

export class TreasuryWithdrawRepository {
  constructor(private readonly model = TreasuryWithdrawEntity) {}

  async create(data: Pick<ITreasuryWithdrawEntity,
    "recipient" |
    "token" |
    "chainId" |
    "transactionHash" |
    "logIndex"
  > & {amount: string}) {
    logger.debug(`Creating treasury withdraw: ${data.amount} ${data.token} to ${data.recipient}`);

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
    logger.debug(`Finding treasury withdraws with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}