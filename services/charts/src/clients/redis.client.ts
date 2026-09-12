import { RedisEventsClient } from '@shared/redis-events/src/redis-events.client';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class ChartEventsClient {
  constructor(private readonly redisClient: RedisEventsClient) {}

  @TraceDecorator()
  async publishPriceUpdate(data: {
    poolAddress: string;
    timestamp: number;
    price: string;
    realHoldReserve: string;
    virtualHoldReserve: string;
    virtualRwaReserve: string;
  }) {
    await this.redisClient.publish(`charts:price:${data.poolAddress}`, 'PRICE_UPDATE', data);
  }

  @TraceDecorator()
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
    await this.redisClient.publish(`charts:transactions:${data.poolAddress}`, 'TRANSACTION_UPDATE', data);
  }
}
