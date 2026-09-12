import type { FilterQuery, SortOrder } from 'mongoose';
import { PoolTransactionEntity } from '../models/entity/poolTransaction.entity';
import type { IPoolTransactionEntity } from '../models/entity/poolTransaction.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class PoolTransactionRepository {
  constructor(private readonly model = PoolTransactionEntity) {}

  @TraceDecorator()
  async create(
    data: Pick<
      IPoolTransactionEntity,
      | 'poolAddress'
      | 'transactionType'
      | 'userAddress'
      | 'timestamp'
      | 'rwaAmount'
      | 'holdAmount'
      | 'bonusAmount'
      | 'holdFee'
      | 'bonusFee'
    >,
  ) {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  @TraceDecorator()
  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { timestamp: 'desc' },
    limit: number = 100,
    offset: number = 0,
  ) {
    return await this.model.find(filter).sort(sort).skip(offset).limit(limit).lean();
  }

  @TraceDecorator()
  async aggregateVolumeData(
    poolAddress: string,
    intervalSeconds: number,
    startTime: number,
    endTime: number,
    limit?: number,
  ): Promise<
    {
      timestamp: number;
      mintVolume: string;
      burnVolume: string;
    }[]
  > {
    const aggregationPipeline: any[] = [
      {
        $match: {
          poolAddress,
          timestamp: { $gte: startTime, $lte: endTime },
        },
      },
      {
        $group: {
          _id: {
            // Group by time intervals
            interval: {
              $subtract: ['$timestamp', { $mod: ['$timestamp', intervalSeconds] }],
            },
            type: '$transactionType',
          },
          volume: { $sum: { $toDecimal: '$rwaAmount' } },
        },
      },
      {
        $group: {
          _id: '$_id.interval',
          volumes: {
            $push: {
              type: '$_id.type',
              volume: '$volume',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          timestamp: '$_id',
          mintVolume: {
            $toString: {
              $reduce: {
                input: {
                  $filter: {
                    input: '$volumes',
                    as: 'v',
                    cond: { $eq: ['$$v.type', 'MINT'] },
                  },
                },
                initialValue: '0',
                in: { $toString: '$$this.volume' },
              },
            },
          },
          burnVolume: {
            $toString: {
              $reduce: {
                input: {
                  $filter: {
                    input: '$volumes',
                    as: 'v',
                    cond: { $eq: ['$$v.type', 'BURN'] },
                  },
                },
                initialValue: '0',
                in: { $toString: '$$this.volume' },
              },
            },
          },
        },
      },
      {
        $sort: { timestamp: 1 },
      },
    ];

    if (limit && limit > 0) {
      aggregationPipeline.push({ $limit: limit });
    }

    const results = await this.model.aggregate(aggregationPipeline).exec();
    return results;
  }
}
