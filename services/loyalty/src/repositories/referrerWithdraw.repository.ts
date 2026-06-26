import type { FilterQuery, SortOrder } from 'mongoose';
import mongoose from 'mongoose';
import { ReferrerWithdrawEntity } from '../models/entity/referrerWithdraw.entity';
import type { IReferrerWithdrawEntity } from '../models/entity/referrerWithdraw.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class ReferrerWithdrawRepository {
  constructor(private readonly model = ReferrerWithdrawEntity) {}

  @TraceDecorator()
  async createOrUpdate(
    data: Pick<
      IReferrerWithdrawEntity,
      'referrerWallet' | 'referrerId' | 'chainId' | 'tokenAddress' | 'taskId' | 'taskExpiredAt' | 'taskCooldown'
    > & {
      totalWithdrawnAmount: string | mongoose.Types.Decimal128;
    },
  ) {
    // Convert string to Decimal128 if needed
    const updateData = {
      ...data,
      totalWithdrawnAmount:
        typeof data.totalWithdrawnAmount === 'string'
          ? mongoose.Types.Decimal128.fromString(data.totalWithdrawnAmount)
          : data.totalWithdrawnAmount,
    };

    const doc = await this.model
      .findOneAndUpdate(
        {
          referrerWallet: data.referrerWallet,
          referrerId: data.referrerId,
          chainId: data.chainId,
          tokenAddress: data.tokenAddress,
        },
        updateData,
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
  async addWithdrawnAmount(
    referrerWallet: string,
    referrerId: string,
    chainId: string,
    tokenAddress: string,
    amount: string,
  ) {
    const doc = await this.model
      .findOneAndUpdate(
        { referrerWallet, referrerId, chainId, tokenAddress },
        {
          $inc: {
            totalWithdrawnAmount: mongoose.Types.Decimal128.fromString(amount),
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
  async findByReferrerAndToken(referrerWallet: string, referrerId: string, chainId: string, tokenAddress: string) {
    const doc = await this.model
      .findOne({
        referrerWallet,
        referrerId,
        chainId,
        tokenAddress,
      })
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
