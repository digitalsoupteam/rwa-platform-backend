import type { FilterQuery, SortOrder } from 'mongoose';
import mongoose from 'mongoose';
import { StakingEntity } from '../models/entity/staking.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class StakingRepository {
  constructor(private readonly model = StakingEntity) {}

  /**
   * Mirrors the absolute staked amount from a staking event ($set, not $inc):
   * the events carry the full post-state (newVotingPower - the same number the
   * contract returns from getVotingPower()), and blockchain events are applied
   * strictly in chain order, so the value can be assigned as-is.
   * `lastStakeTimestamp` moves only when the contract stakingTimestamp does
   * (stake, and partial unstake - not a full exit).
   */
  @TraceDecorator()
  async setAmount(staker: string, chainId: string, amount: string, lastStakeTimestamp?: number) {
    const doc = await this.model
      .findOneAndUpdate(
        { staker, chainId },
        {
          $set: {
            amount: mongoose.Types.Decimal128.fromString(amount),
            updatedAt: Math.floor(Date.now() / 1000),
            ...(lastStakeTimestamp !== undefined && { lastStakeTimestamp }),
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
  async setUnlockTimestamp(staker: string, chainId: string, unlockTimestamp: number) {
    const doc = await this.model
      .findOneAndUpdate(
        { staker, chainId },
        {
          $set: {
            unlockTimestamp,
            updatedAt: Math.floor(Date.now() / 1000),
          },
        },
        { new: true },
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
