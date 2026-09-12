import type { FilterQuery, SortOrder } from 'mongoose';
import { PriceDataEntity } from '../models/entity/priceData.entity';
import type { IPriceDataEntity } from '../models/entity/priceData.entity';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

// Define the type for the data needed to create a PriceData entry
// Excludes _id, createdAt, and updatedAt as they are auto-managed or set by default
type CreatePriceData = Omit<IPriceDataEntity, '_id' | 'createdAt' | 'updatedAt'>;

export class PriceDataRepository {
  constructor(private readonly model = PriceDataEntity) {}

  @TraceDecorator()
  async create(data: CreatePriceData): Promise<IPriceDataEntity> {
    const doc = await this.model.create(data);
    return doc.toObject() as IPriceDataEntity;
  }

  @TraceDecorator()
  async findAll(
    filter: FilterQuery<IPriceDataEntity> = {},
    sort: { [key: string]: SortOrder | { $meta: 'textScore' } } = { timestamp: 'asc' },
    limit: number = 100,
    offset: number = 0,
  ): Promise<IPriceDataEntity[]> {
    return await this.model.find(filter).sort(sort).skip(offset).limit(limit).lean<IPriceDataEntity[]>().exec();
  }

  @TraceDecorator()
  async findLatestByPoolAddress(poolAddress: string): Promise<IPriceDataEntity | null> {
    const doc = await this.model
      .findOne({ poolAddress })
      .sort({ timestamp: -1 }) // Get the most recent entry
      .lean<IPriceDataEntity>()
      .exec();

    if (!doc) {
      return null;
    }

    return doc;
  }

  @TraceDecorator()
  async findByPoolAndTimeRange(
    poolAddress: string,
    startTime: number,
    endTime: number,
    sort: { [key: string]: SortOrder } = { timestamp: 'asc' },
    limit: number = 1000,
    offset: number = 0,
  ): Promise<IPriceDataEntity[]> {
    const filter: FilterQuery<IPriceDataEntity> = {
      poolAddress,
      timestamp: {
        $gte: startTime,
        $lte: endTime,
      },
    };
    return this.findAll(filter, sort, limit, offset);
  }

  @TraceDecorator()
  async aggregateOhlcData(
    poolAddress: string,
    intervalSeconds: number,
    startTime: number,
    endTime: number,
    limit?: number,
  ): Promise<
    {
      timestamp: number;
      open: string;
      high: string;
      low: string;
      close: string;
    }[]
  > {
    const aggregationPipeline: any[] = [
      {
        $match: {
          poolAddress: poolAddress,
          timestamp: { $gte: startTime, $lte: endTime },
        },
      },
      {
        $sort: { timestamp: 1 },
      },
      {
        $group: {
          _id: {
            $subtract: ['$timestamp', { $mod: ['$timestamp', intervalSeconds] }],
          },
          open: { $first: '$price' },
          high: { $max: '$price' },
          low: { $min: '$price' },
          close: { $last: '$price' },
        },
      },
      {
        $project: {
          _id: 0,
          timestamp: '$_id',
          open: '$open',
          high: '$high',
          low: '$low',
          close: '$close',
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
    return results as {
      timestamp: number;
      open: string;
      high: string;
      low: string;
      close: string;
    }[];
  }
}
