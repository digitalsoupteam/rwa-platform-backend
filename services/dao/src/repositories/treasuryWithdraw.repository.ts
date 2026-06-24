import type { FilterQuery, SortOrder } from "mongoose";
import mongoose from "mongoose";
import { TreasuryWithdrawEntity } from "../models/entity/treasuryWithdraw.entity";
import type { ITreasuryWithdrawEntity } from "../models/entity/treasuryWithdraw.entity";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";


export class TreasuryWithdrawRepository {
  constructor(private readonly model = TreasuryWithdrawEntity) {}

  @TraceDecorator()
  async create(data: Pick<ITreasuryWithdrawEntity,
    "recipient" |
    "token" |
    "chainId" |
    "transactionHash" |
    "logIndex"
  > & {amount: string}) {
    const doc = await this.model.create({
      ...data,
      amount: mongoose.Types.Decimal128.fromString(data.amount)
    });
    return doc.toObject();
  }

  @TraceDecorator()
  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}
