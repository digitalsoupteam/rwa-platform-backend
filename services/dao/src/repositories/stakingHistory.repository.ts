import type { FilterQuery, SortOrder } from 'mongoose';
import mongoose from 'mongoose';
import { StakingHistoryEntity } from '../models/entity/stakingHistory.entity';
import type { IStakingHistoryEntity } from '../models/entity/stakingHistory.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class StakingHistoryRepository {
  constructor(private readonly model = StakingHistoryEntity) {}

  @TraceDecorator()
  async create(
    data: Pick<IStakingHistoryEntity, 'staker' | 'operation' | 'chainId' | 'transactionHash' | 'logIndex'> & {
      amount: string;
    },
  ) {
    const doc = await this.model.create({
      ...data,
      amount: mongoose.Types.Decimal128.fromString(data.amount),
    });
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
