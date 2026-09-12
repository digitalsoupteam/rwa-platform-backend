import { AppError } from '@shared/errors/app-errors';
import type { FilterQuery, SortOrder } from 'mongoose';
import { TokenBalanceEntity } from '../models/entity/tokenBalance.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class TokenBalanceRepository {
  constructor(private readonly model = TokenBalanceEntity) {}

  @TraceDecorator()
  async findById(id: string) {
    const balance = await this.model.findById(id).lean();

    if (!balance) {
      throw new AppError({
        message: `TokenBalance ${id} not found`,
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return balance;
  }

  @TraceDecorator()
  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'asc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    return await this.model.find(filter).sort(sort).skip(offset).limit(limit).lean();
  }

  /**
   * Update balance by incrementing/decrementing the amount
   */
  @TraceDecorator()
  async updateBalance(
    owner: string,
    tokenAddress: string,
    tokenId: string,
    poolAddress: string,
    chainId: string,
    amount: number,
    lastUpdateBlock: number,
  ) {
    const balance = await this.model
      .findOneAndUpdate(
        { owner, tokenAddress, tokenId, poolAddress, chainId },
        {
          $inc: { balance: amount },
          $set: { lastUpdateBlock },
          $setOnInsert: {
            owner,
            tokenAddress,
            tokenId,
            poolAddress,
            chainId,
          },
        },
        { new: true, upsert: true },
      )
      .lean();

    return balance;
  }
}
