import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder } from "mongoose";
import {
  TokenBalanceEntity,
  ITokenBalanceEntity,
} from "../models/entity/tokenBalance.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
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
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "asc" },
    limit: number = 100,
    offset: number = 0
  ) {
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
    tokenId: string,
    poolAddress: string,
    chainId: string,
    amount: number,
    lastUpdateBlock: number
  ) {
    logger.debug(`Updating balance for ${owner} - ${tokenAddress} - ${tokenId} by ${amount}`);
    
    const balance = await this.model.findOneAndUpdate(
      { owner, tokenAddress, tokenId, poolAddress, chainId },
      {
        $inc: { balance: amount },
        $set: { lastUpdateBlock },
        $setOnInsert: {
          owner,
          tokenAddress,
          tokenId,
          poolAddress,
          chainId
        }
      },
      { new: true, upsert: true }
    ).lean();

    return balance;
  }
}