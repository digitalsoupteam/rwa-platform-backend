import type { FilterQuery, SortOrder } from 'mongoose';
import mongoose from 'mongoose';
import { ReferrerClaimHistoryEntity } from '../models/entity/referrerClaimHistory.entity';
import type { IReferrerClaimHistoryEntity } from '../models/entity/referrerClaimHistory.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class ReferrerClaimHistoryRepository {
  constructor(private readonly model = ReferrerClaimHistoryEntity) {}

  @TraceDecorator()
  async create(
    data: Pick<
      IReferrerClaimHistoryEntity,
      | 'referrerWallet'
      | 'referrerId'
      | 'chainId'
      | 'tokenAddress'
      | 'referralWallet'
      | 'transactionHash'
      | 'logIndex'
      | 'blockNumber'
    > & { amount: string },
  ) {
    const createData = {
      ...data,
      amount: mongoose.Types.Decimal128.fromString(data.amount),
    };

    const doc = await this.model.create(createData);
    return doc.toObject();
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
