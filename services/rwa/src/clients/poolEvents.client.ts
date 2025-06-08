import { RedisEventsClient } from "@shared/redis-events/src/redis-events.client";
import { logger } from "@shared/monitoring/src/logger";
import { IPoolDTO } from "../models/validation/pool.validation";

export class PoolEventsClient {
  constructor(private readonly redisClient: RedisEventsClient) {}

  async publishPoolDeployed(pool: IPoolDTO) {
    try {
      await this.redisClient.publish(
        'pool:deployed',
        "POOL_DEPLOYED",
        pool
      );
      logger.debug(`Published pool deployed event for pool ${pool.poolAddress}`);
    } catch (error) {
      logger.error(`Failed to publish pool deployed event for pool ${pool.poolAddress}:`, error);
      throw error;
    }
  }
}