import { RedisEventsClient } from "@shared/redis-events/src/redis-events.client";
import { logger } from "@shared/monitoring/src/logger";


export class ChartEventsClient {
  constructor(private readonly redisClient: RedisEventsClient) { }

  async publishPriceUpdate(data: {
    poolAddress: string;
    timestamp: number;
    price: string;
    realHoldReserve: string;
    virtualHoldReserve: string;
    virtualRwaReserve: string;
  }) {
    try {
      await this.redisClient.publish(
        `charts:price:${data.poolAddress}`,
        "PRICE_UPDATE",
        data
      );
      logger.debug(`Published price update for pool ${data.poolAddress}`);
    } catch (error) {
      logger.error(`Failed to publish price update for pool ${data.poolAddress}:`, error);
      throw error;
    }
  }

  async publishTransactionUpdate(data: {
    poolAddress: string;
    timestamp: number;
    transactionType: string;
    userAddress: string;
    rwaAmount: string;
    holdAmount: string;
    bonusAmount: string;
    holdFee: string;
    bonusFee: string;
  }) {
    try {
      await this.redisClient.publish(
        `charts:transactions:${data.poolAddress}`,
        "TRANSACTION_UPDATE",
        data
      );
      logger.debug(`Published transaction update for pool ${data.poolAddress}`);
    } catch (error) {
      logger.error(`Failed to publish transaction update for pool ${data.poolAddress}:`, error);
      throw error;
    }
  }
}