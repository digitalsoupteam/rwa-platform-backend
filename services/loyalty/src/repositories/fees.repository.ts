import type { FilterQuery, SortOrder } from 'mongoose';
import mongoose from 'mongoose';
import { FeesEntity } from '../models/entity/fees.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class FeesRepository {
  constructor(private readonly model = FeesEntity) {}

  @TraceDecorator()
  async addBuyCommission(userWallet: string, userId: string, chainId: string, tokenAddress: string, amount: string) {
    const doc = await this.model
      .findOneAndUpdate(
        { userWallet, userId, chainId, tokenAddress },
        {
          $set: { userId },
          $inc: {
            buyCommissionCount: 1,
            buyCommissionAmount: mongoose.Types.Decimal128.fromString(amount),
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
  async addSellCommission(userWallet: string, userId: string, chainId: string, tokenAddress: string, amount: string) {
    const doc = await this.model
      .findOneAndUpdate(
        { userWallet, userId, chainId, tokenAddress },
        {
          $set: { userId },
          $inc: {
            sellCommissionCount: 1,
            sellCommissionAmount: mongoose.Types.Decimal128.fromString(amount),
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
  async addTokenCreationCommission(
    userWallet: string,
    userId: string,
    chainId: string,
    tokenAddress: string,
    amount: string,
  ) {
    const doc = await this.model
      .findOneAndUpdate(
        { userWallet, userId, chainId, tokenAddress },
        {
          $set: { userId },
          $inc: {
            tokenCreationCommissionCount: 1,
            tokenCreationCommissionAmount: mongoose.Types.Decimal128.fromString(amount),
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
  async addPoolCreationCommission(
    userWallet: string,
    userId: string,
    chainId: string,
    tokenAddress: string,
    amount: string,
  ) {
    const doc = await this.model
      .findOneAndUpdate(
        { userWallet, userId, chainId, tokenAddress },
        {
          $set: { userId },
          $inc: {
            poolCreationCommissionCount: 1,
            poolCreationCommissionAmount: mongoose.Types.Decimal128.fromString(amount),
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
  async addReferralReward(userWallet: string, userId: string, chainId: string, tokenAddress: string, amount: string) {
    const doc = await this.model
      .findOneAndUpdate(
        { userWallet, userId, chainId, tokenAddress },
        {
          $set: { userId },
          $inc: {
            referralRewardCount: 1,
            referralRewardAmount: mongoose.Types.Decimal128.fromString(amount),
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
