import { logger } from "@shared/monitoring/src/logger";
import { NotFoundError } from "@shared/errors/app-errors";
import { FilterQuery, SortOrder, Types } from "mongoose";
import {
  PriceDataEntity,
  IPriceDataEntity,
} from "../models/entity/priceData.entity";

// Define the type for the data needed to create a PriceData entry
// Excludes _id, createdAt, and updatedAt as they are auto-managed or set by default
type CreatePriceData = Omit<IPriceDataEntity, '_id' | 'createdAt' | 'updatedAt'>;

export class PriceDataRepository {
  constructor(private readonly model = PriceDataEntity) {}

  async create(data: CreatePriceData): Promise<IPriceDataEntity> {
    logger.debug(`Creating price data for pool: ${data.poolAddress} at timestamp: ${data.timestamp}`);
    const doc = await this.model.create(data);
    return doc.toObject() as IPriceDataEntity;
  }

  async findAll(
    filter: FilterQuery<IPriceDataEntity> = {},
    sort: { [key: string]: SortOrder | { $meta: "textScore" } } = { timestamp: "asc" },
    limit: number = 100,
    offset: number = 0
  ): Promise<IPriceDataEntity[]> {
    logger.debug(`Finding price data with query: ${JSON.stringify(filter)}, sort: ${JSON.stringify(sort)}, limit: ${limit}, offset: ${offset}`);
    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean<IPriceDataEntity[]>()
      .exec();
  }

  async findLatestByPoolAddress(poolAddress: string): Promise<IPriceDataEntity | null> {
    logger.debug(`Finding latest price data by poolAddress: ${poolAddress}`);
    const doc = await this.model
      .findOne({ poolAddress })
      .sort({ timestamp: -1 }) // Get the most recent entry
      .lean<IPriceDataEntity>()
      .exec();

    if (!doc) {
      // It's okay for this to return null if no data exists, not necessarily a NotFoundError
      // unless specific business logic requires an entry to always exist.
      logger.warn(`No price data found for poolAddress: ${poolAddress}`);
      return null;
    }

    return doc;
  }

  // Potentially add more specific query methods if needed, e.g., for aggregation for OHLC data,
  // though often aggregation is handled in a service layer or directly via MongoDB's aggregation framework.
  // For example, to get data for a specific pool within a time range:
  async findByPoolAndTimeRange(
    poolAddress: string,
    startTime: number, // Unix timestamp
    endTime: number,   // Unix timestamp
    sort: { [key: string]: SortOrder } = { timestamp: "asc" },
    limit: number = 1000, // Default to a higher limit for chart data
    offset: number = 0
  ): Promise<IPriceDataEntity[]> {
    logger.debug(`Finding price data for pool ${poolAddress} between ${startTime} and ${endTime}`);
    const filter: FilterQuery<IPriceDataEntity> = {
      poolAddress,
      timestamp: {
        $gte: startTime,
        $lte: endTime,
      },
    };
    return this.findAll(filter, sort, limit, offset);
  }

  async aggregateOhlcData(
    poolAddress: string,
    intervalSeconds: number,
    startTime: number,
    endTime: number,
    limit?: number
  ): Promise<{
    timestamp: number;
    open: string;
    high: string;
    low: string;
    close: string;
  }[]> {
    logger.debug(
      `Aggregating OHLC data for pool: ${poolAddress}, intervalSeconds: ${intervalSeconds}, startTime: ${startTime}, endTime: ${endTime}`
    );

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
            $subtract: [
              "$timestamp",
              { $mod: ["$timestamp", intervalSeconds] },
            ],
          },
          open: { $first: "$price" },
          high: { $max: "$price" },
          low: { $min: "$price" },
          close: { $last: "$price" },
        },
      },
      {
        $project: {
          _id: 0,
          timestamp: "$_id",
          open: "$open",
          high: "$high",
          low: "$low",
          close: "$close",
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