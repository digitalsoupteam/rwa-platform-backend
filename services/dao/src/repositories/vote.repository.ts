import type { FilterQuery, SortOrder } from 'mongoose';
import mongoose from 'mongoose';
import { VoteEntity } from '../models/entity/vote.entity';
import type { IVoteEntity } from '../models/entity/vote.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class VoteRepository {
  constructor(private readonly model = VoteEntity) {}

  @TraceDecorator()
  async create(
    data: Pick<
      IVoteEntity,
      | 'proposalId'
      | 'chainId'
      | 'governanceAddress'
      | 'voterWallet'
      | 'support'
      | 'reason'
      | 'transactionHash'
      | 'logIndex'
      | 'blockNumber'
    > & { weight: string },
  ) {
    const doc = await this.model.create({
      ...data,
      weight: mongoose.Types.Decimal128.fromString(data.weight),
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
