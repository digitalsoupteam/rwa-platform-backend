import { logger } from "@shared/monitoring/src/logger";
import { FilterQuery, SortOrder } from "mongoose";
import mongoose from "mongoose";
import { StakingEntity, IStakingEntity } from "../models/entity/staking.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class StakingRepository {
  constructor(private readonly model = StakingEntity) {}

  async addStake(staker: string, chainId: string, amount: string, lastStakeTimestamp: number) {
    logger.debug(`Adding stake: ${amount} for staker: ${staker} on chain: ${chainId}`);
    
    const doc = await this.model.findOneAndUpdate(
      { staker, chainId },
      {
        $inc: {
          amount: mongoose.Types.Decimal128.fromString(amount)
        },
        $set: {
          lastStakeTimestamp,
          updatedAt: Math.floor(Date.now() / 1000)
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    ).lean();

    return doc;
  }

  async subStake(staker: string, chainId: string, amount: string) {
    logger.debug(`Subtracting stake: ${amount} for staker: ${staker} on chain: ${chainId}`);
    
    const doc = await this.model.findOneAndUpdate(
      { staker, chainId },
      {
        $inc: {
          amount: mongoose.Types.Decimal128.fromString(`-${amount}`)
        },
        $set: {
          updatedAt: Math.floor(Date.now() / 1000)
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    ).lean();

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding staking records with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}