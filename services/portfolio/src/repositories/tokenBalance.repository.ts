import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder } from "mongoose";
import {
  TokenBalanceEntity,
  ITokenBalanceEntity,
} from "../models/entity/tokenBalance.entity";

export class TokenBalanceRepository {
  constructor(private readonly model = TokenBalanceEntity) {}

  async findById(id: string) {
    logger.debug(`Finding token balance by ID: ${id}`);
    const balance = await this.model.findById(id).lean();

    if (!balance) {
      throw new NotFoundError("TokenBalance", id);
    }

    return balance;
  }

  async findAll(
    query: {
      owners?: string[];
      tokenAddresses?: string[];
      chainIds?: string[];
    },
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0
  ) {
    const filter: FilterQuery<typeof this.model> = {};

    if(query.owners) {
      if (query.owners.length === 1) {
        filter.owner = query.owners[0];
      } else if (query.owners.length > 1) {
        filter.owner = { $in: query.owners };
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

    logger.debug(`Finding token balances with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }

  /**
   * Update balance by incrementing/decrementing the amount
   */
  async updateBalance(
    owner: string,
    tokenAddress: string,
    chainId: string,
    amount: number,
    lastUpdateBlock: number
  ) {
    logger.debug(`Updating balance for ${owner} - ${tokenAddress} by ${amount}`);
    
    const balance = await this.model.findOneAndUpdate(
      { owner, tokenAddress, chainId },
      {
        $inc: { balance: amount },
        $set: { lastUpdateBlock },
        $setOnInsert: {
          owner,
          tokenAddress,
          chainId
        }
      },
      { new: true, upsert: true }
    ).lean();

    return balance;
  }
}