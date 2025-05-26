import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder } from "mongoose";
import {
  TransactionEntity,
  ITransactionEntity,
} from "../models/entity/transaction.entity";

export class TransactionRepository {
  constructor(private readonly model = TransactionEntity) {}

  async create(data: Pick<ITransactionEntity, "from" | "to" | "tokenAddress" | "tokenId" | "pool" | "chainId" | "transactionHash" | "blockNumber" | "amount">) {
    logger.debug(`Creating transaction record: ${data.transactionHash}`);
    const transaction = await this.model.create(data);
    return transaction.toObject();
  }

  async findById(id: string) {
    logger.debug(`Finding transaction by ID: ${id}`);
    const transaction = await this.model.findById(id).lean();

    if (!transaction) {
      throw new NotFoundError("Transaction", id);
    }

    return transaction;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { blockNumber: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding transactions with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}