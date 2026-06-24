import type { FilterQuery, SortOrder } from "mongoose";
import mongoose from "mongoose";
import { CommissionHistoryEntity } from "../models/entity/commissionHistory.entity";
import type { ICommissionHistoryEntity } from "../models/entity/commissionHistory.entity";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";


export class CommissionHistoryRepository {
  constructor(private readonly model = CommissionHistoryEntity) {}

  @TraceDecorator()
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

    const createData = {
      ...data,
      amount: mongoose.Types.Decimal128.fromString(data.amount)
    };

    const doc = await this.model.create(createData);
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
