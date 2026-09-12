import type { FilterQuery, SortOrder } from 'mongoose';
import mongoose from 'mongoose';
import { StakingEntity } from '../models/entity/staking.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class StakingRepository {
  constructor(private readonly model = StakingEntity) {}

  @TraceDecorator()
  async addStake(staker: string, chainId: string, amount: string, lastStakeTimestamp: number) {
    const doc = await this.model
      .findOneAndUpdate(
        { staker, chainId },
        {
          $inc: {
            amount: mongoose.Types.Decimal128.fromString(amount),
          },
          $set: {
            lastStakeTimestamp,
            updatedAt: Math.floor(Date.now() / 1000),
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      )
      .lean();

    return doc;
  }

  @TraceDecorator()
  async subStake(staker: string, chainId: string, amount: string) {
    const doc = await this.model
      .findOneAndUpdate(
        { staker, chainId },
        {
          $inc: {
            amount: mongoose.Types.Decimal128.fromString(`-${amount}`),
          },
          $set: {
            updatedAt: Math.floor(Date.now() / 1000),
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      )
      .lean();

    return doc;
  }

  @TraceDecorator()
  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: 'desc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    return await this.model.find(filter).sort(sort).skip(offset).limit(limit).lean();
  }
}
