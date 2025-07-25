import { logger } from "@shared/monitoring/src/logger";
import { FilterQuery, SortOrder } from "mongoose";
import mongoose from "mongoose";
import { ReferrerWithdrawEntity, IReferrerWithdrawEntity } from "../models/entity/referrerWithdraw.entity";

export class ReferrerWithdrawRepository {
  constructor(private readonly model = ReferrerWithdrawEntity) {}

  async createOrUpdate(data: Pick<IReferrerWithdrawEntity,
    "referrerWallet" |
    "referrerId" |
    "chainId" |
    "tokenAddress" |
    "taskId" |
    "taskExpiredAt" |
    "taskCooldown"
  > & {
    totalWithdrawnAmount: string | mongoose.Types.Decimal128;
  }) {
    logger.debug(`Creating or updating referrer withdraw for wallet: ${data.referrerWallet}, chain: ${data.chainId}, token: ${data.tokenAddress}`);
    
    // Convert string to Decimal128 if needed
    const updateData = {
      ...data,
      totalWithdrawnAmount: typeof data.totalWithdrawnAmount === 'string'
        ? mongoose.Types.Decimal128.fromString(data.totalWithdrawnAmount)
        : data.totalWithdrawnAmount
    };
    
    const doc = await this.model.findOneAndUpdate(
      {
        referrerWallet: data.referrerWallet,
        referrerId: data.referrerId,
        chainId: data.chainId,
        tokenAddress: data.tokenAddress
      },
      updateData,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    ).lean();

    return doc;
  }

  async addWithdrawnAmount(referrerWallet: string, referrerId: string, chainId: string, tokenAddress: string, amount: string) {
    logger.debug(`Adding withdrawn amount: ${amount} for referrer: ${referrerWallet}`);
    
    const doc = await this.model.findOneAndUpdate(
      { referrerWallet, referrerId, chainId, tokenAddress },
      {
        $inc: {
          totalWithdrawnAmount: mongoose.Types.Decimal128.fromString(amount)
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

  async findByReferrerAndToken(referrerWallet: string, referrerId: string, chainId: string, tokenAddress: string) {
    logger.debug(`Finding referrer withdraw by wallet: ${referrerWallet}, chain: ${chainId}, token: ${tokenAddress}`);

    const doc = await this.model.findOne({
      referrerWallet,
      referrerId,
      chainId,
      tokenAddress
    }).lean();

    return doc;
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { createdAt: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding referrer withdraws with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }
}