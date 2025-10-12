import { logger } from "@shared/monitoring/src/logger";
import { FilterQuery, SortOrder } from "mongoose";
import {
  PoolTransactionEntity,
  IPoolTransactionEntity,
  PoolTransactionType
} from "../models/entity/poolTransaction.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class PoolTransactionRepository {
  constructor(private readonly model = PoolTransactionEntity) {}

  async create(data: Pick<IPoolTransactionEntity, 
    'poolAddress' | 
    'transactionType' | 
    'userAddress' | 
    'timestamp' | 
    'rwaAmount' | 
    'holdAmount' | 
    'bonusAmount' | 
    'holdFee' | 
    'bonusFee'
  >) {
    logger.debug(`Creating pool transaction: ${data.transactionType} for pool ${data.poolAddress}`);
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async findAll(
    filter: FilterQuery<typeof this.model> = {},
    sort: { [key: string]: SortOrder } = { timestamp: "desc" },
    limit: number = 100,
    offset: number = 0
  ) {
    logger.debug(`Finding transactions with query: ${JSON.stringify(filter)}`);

    return await this.model
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();
  }

  async aggregateVolumeData(
    poolAddress: string,
    intervalSeconds: number,
    startTime: number,
    endTime: number,
    limit?: number
  ): Promise<{
    timestamp: number;
    mintVolume: string;
    burnVolume: string;
  }[]> {
    logger.debug(
      `Aggregating volume data for pool: ${poolAddress}, intervalSeconds: ${intervalSeconds}, startTime: ${startTime}, endTime: ${endTime}`
    );

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
              $subtract: [
                "$timestamp",
                { $mod: ["$timestamp", intervalSeconds] },
              ],
            },
            type: "$transactionType"
          },
          volume: { $sum: { $toDecimal: "$rwaAmount" } },
        },
      },
      {
        $group: {
          _id: "$_id.interval",
          volumes: {
            $push: {
              type: "$_id.type",
              volume: "$volume"
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          timestamp: "$_id",
          mintVolume: {
            $toString: {
              $reduce: {
                input: {
                  $filter: {
                    input: "$volumes",
                    as: "v",
                    cond: { $eq: ["$$v.type", "MINT"] }
                  }
                },
                initialValue: "0",
                in: { $toString: "$$this.volume" }
              }
            }
          },
          burnVolume: {
            $toString: {
              $reduce: {
                input: {
                  $filter: {
                    input: "$volumes",
                    as: "v",
                    cond: { $eq: ["$$v.type", "BURN"] }
                  }
                },
                initialValue: "0",
                in: { $toString: "$$this.volume" }
              }
            }
          }
        }
      },
      {
        $sort: { timestamp: 1 }
      }
    ];

    if (limit && limit > 0) {
      aggregationPipeline.push({ $limit: limit });
    }

    const results = await this.model.aggregate(aggregationPipeline).exec();
    return results;
  }
}