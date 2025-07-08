import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder } from "mongoose";
import mongoose from "mongoose";
import { FeesEntity, IFeesEntity } from "../models/entity/fees.entity";

export class FeesRepository {
  constructor(private readonly model = FeesEntity) {}


  async addBuyCommission(userWallet: string, chainId: string, tokenAddress: string, amount: string) {
    logger.debug(`Adding buy commission: ${amount} for wallet: ${userWallet}`);
    
    const doc = await this.model.findOneAndUpdate(
      { userWallet, chainId, tokenAddress },
      {
        $inc: {
          buyCommissionCount: 1,
          buyCommissionAmount: mongoose.Types.Decimal128.fromString(amount)
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

  async addSellCommission(userWallet: string, chainId: string, tokenAddress: string, amount: string) {
    logger.debug(`Adding sell commission: ${amount} for wallet: ${userWallet}`);
    
    const doc = await this.model.findOneAndUpdate(
      { userWallet, chainId, tokenAddress },
      {
        $inc: {
          sellCommissionCount: 1,
          sellCommissionAmount: mongoose.Types.Decimal128.fromString(amount)
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

  async addTokenCreationCommission(userWallet: string, chainId: string, tokenAddress: string, amount: string) {
    logger.debug(`Adding token creation commission: ${amount} for wallet: ${userWallet}`);
    
    const doc = await this.model.findOneAndUpdate(
      { userWallet, chainId, tokenAddress },
      {
        $inc: {
          tokenCreationCommissionCount: 1,
          tokenCreationCommissionAmount: mongoose.Types.Decimal128.fromString(amount)
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

  async addPoolCreationCommission(userWallet: string, chainId: string, tokenAddress: string, amount: string) {
    logger.debug(`Adding pool creation commission: ${amount} for wallet: ${userWallet}`);
    
    const doc = await this.model.findOneAndUpdate(
      { userWallet, chainId, tokenAddress },
      {
        $inc: {
          poolCreationCommissionCount: 1,
          poolCreationCommissionAmount: mongoose.Types.Decimal128.fromString(amount)
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

  async addReferralReward(userWallet: string, chainId: string, tokenAddress: string, amount: string) {
    logger.debug(`Adding referral reward: ${amount} for wallet: ${userWallet}`);
    
    const doc = await this.model.findOneAndUpdate(
      { userWallet, chainId, tokenAddress },
      {
        $inc: {
          referralRewardCount: 1,
          referralRewardAmount: mongoose.Types.Decimal128.fromString(amount)
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
    logger.debug(`Finding fees with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}