import type { FilterQuery, SortOrder } from 'mongoose';
import { TimelockTaskEntity } from '../models/entity/timelockTask.entity';
import type { ITimelockTaskEntity } from '../models/entity/timelockTask.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class TimelockTaskRepository {
  constructor(private readonly model = TimelockTaskEntity) {}

  @TraceDecorator()
  async create(
    data: Pick<
      ITimelockTaskEntity,
      'txHash' | 'target' | 'data' | 'eta' | 'chainId' | 'transactionHash' | 'logIndex' | 'blockNumber'
    >,
  ) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async updateExecuted(chainId: string, txHash: string, executed: boolean = true) {
    const doc = await this.model
      .findOneAndUpdate(
        { chainId, txHash },
        {
          executed,
          updatedAt: Math.floor(Date.now() / 1000),
        },
        { new: true },
      )
      .lean();

    return doc;
  }

  /**
   * Mirrors Timelock.cancelTransaction: the chain deletes the queued entry,
   * so the task stops counting as pending; the record itself is kept for audit.
   */
  @TraceDecorator()
  async updateCancelled(chainId: string, txHash: string) {
    const doc = await this.model
      .findOneAndUpdate(
        { chainId, txHash },
        {
          cancelled: true,
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
