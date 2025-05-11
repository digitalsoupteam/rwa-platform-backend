import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder } from "mongoose";
import {
  TransactionEntity,
  ITransactionEntity,
} from "../models/entity/transaction.entity";

export class TransactionRepository {
  constructor(private readonly model = TransactionEntity) {}

  async create(data: Pick<ITransactionEntity, "from" | "to" | "tokenAddress" | "tokenId" | "chainId" | "transactionHash" | "blockNumber" | "amount">) {
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
    query: {
      from?: string[];
      to?: string[];
      tokenAddresses?: string[];
      chainIds?: string[];
      blockNumbers?: number[];
    },
    sort: { [key: string]: SortOrder } = { blockNumber: 'asc' },
    limit: number = 100,
    offset: number = 0
  ) {
    const filter: FilterQuery<typeof this.model> = {};

    if(query.from) {
      if (query.from.length === 1) {
        filter.from = query.from[0];
      } else if (query.from.length > 1) {
        filter.from = { $in: query.from };
      }
    }

    if(query.to) {
      if (query.to.length === 1) {
        filter.to = query.to[0];
      } else if (query.to.length > 1) {
        filter.to = { $in: query.to };
      }
    }

    if(query.tokenAddresses) {
      if (query.tokenAddresses.length === 1) {
        filter.tokenAddress = query.tokenAddresses[0];
      } else if (query.tokenAddresses.length > 1) {
        filter.tokenAddress = { $in: query.tokenAddresses };
      }
    }

    if(query.chainIds) {
      if (query.chainIds.length === 1) {
        filter.chainId = query.chainIds[0];
      } else if (query.chainIds.length > 1) {
        filter.chainId = { $in: query.chainIds };
      }
    }

    if(query.blockNumbers) {
      if (query.blockNumbers.length === 1) {
        filter.blockNumber = query.blockNumbers[0];
      } else if (query.blockNumbers.length > 1) {
        filter.blockNumber = { $in: query.blockNumbers };
      }
    }

    logger.debug(`Finding transactions with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}