import type { FilterQuery, SortOrder } from 'mongoose';
import { ProposalEntity } from '../models/entity/proposal.entity';
import type { IProposalEntity } from '../models/entity/proposal.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class ProposalRepository {
  constructor(private readonly model = ProposalEntity) {}

  @TraceDecorator()
  async create(
    data: Pick<
      IProposalEntity,
      | 'proposalId'
      | 'proposer'
      | 'target'
      | 'data'
      | 'description'
      | 'startTime'
      | 'endTime'
      | 'chainId'
      | 'transactionHash'
      | 'logIndex'
    >,
  ) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async updateState(proposalId: string, state: 'pending' | 'executed' | 'canceled') {
    const doc = await this.model
      .findOneAndUpdate(
        { proposalId },
        {
          state,
          updatedAt: Math.floor(Date.now() / 1000),
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
