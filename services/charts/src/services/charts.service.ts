import { logger } from "@shared/monitoring/src/logger";
import { PriceDataRepository } from "../repositories/priceData.repository";
import { IPriceDataEntity } from "../models/entity/priceData.entity";
import { FilterQuery, SortOrder } from "mongoose";
import { ValidationError } from "@shared/errors/app-errors";
import { ChartEventsClient } from "../clients/redis.client";

export type OhlcInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' | '1w';

export class ChartsService {
  constructor(
    private readonly priceDataRepository: PriceDataRepository,
    private readonly chartEventsClient: ChartEventsClient
  ) {}

  private mapPriceDataToOutput(doc: IPriceDataEntity): Omit<IPriceDataEntity, '_id'> & { id: string } {
    return {
      id: doc._id.toString(),
      poolAddress: doc.poolAddress,
      timestamp: doc.timestamp,
      blockNumber: doc.blockNumber,
      realHoldReserve: doc.realHoldReserve,
      virtualHoldReserve: doc.virtualHoldReserve,
      virtualRwaReserve: doc.virtualRwaReserve,
      price: doc.price,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async recordPriceData(data: {
    poolAddress: string;
    timestamp: number;
    blockNumber: number;
    realHoldReserve: string;
    virtualHoldReserve: string;
    virtualRwaReserve: string;
  }): Promise<Omit<IPriceDataEntity, '_id'> & { id: string }> {
    logger.info(`Recording price data for pool: ${data.poolAddress} at ${data.timestamp}`);

    const virtualRwaReserveBigInt = BigInt(data.virtualRwaReserve);
    if (virtualRwaReserveBigInt === 0n) {
      throw new ValidationError("virtualRwaReserve cannot be zero for price calculation.");
    }

    const virtualHoldReserveBigInt = BigInt(data.virtualHoldReserve);
    const realHoldReserveBigInt = BigInt(data.realHoldReserve);

    const numerator = virtualHoldReserveBigInt + realHoldReserveBigInt;
    const calculatedPriceBigInt = numerator / virtualRwaReserveBigInt;
    const priceString = calculatedPriceBigInt.toString();

    const newPriceEntry: Omit<IPriceDataEntity, '_id' | 'createdAt' | 'updatedAt'> = {
      poolAddress: data.poolAddress,
      timestamp: data.timestamp,
      blockNumber: data.blockNumber,
      realHoldReserve: data.realHoldReserve,
      virtualHoldReserve: data.virtualHoldReserve,
      virtualRwaReserve: data.virtualRwaReserve,
      price: priceString,
    };

    const createdDoc = await this.priceDataRepository.create(newPriceEntry);
    const output = this.mapPriceDataToOutput(createdDoc);

    await this.chartEventsClient.publishPriceUpdate({
      poolAddress: output.poolAddress,
      timestamp: output.timestamp,
      price: output.price,
      realHoldReserve: output.realHoldReserve,
      virtualHoldReserve: output.virtualHoldReserve,
      virtualRwaReserve: output.virtualRwaReserve,
    });

    return output;
  }

  async getRawPriceData(params: {
    poolAddress: string;
    startTime: number;
    endTime: number;
    limit?: number;
    offset?: number;
    sort?: { [key: string]: SortOrder };
  }): Promise<(Omit<IPriceDataEntity, '_id'> & { id: string })[]> {
    logger.debug(`Getting raw price data for pool: ${params.poolAddress}`, params);
    const { poolAddress, startTime, endTime, limit, offset, sort } = params;

    const docs = await this.priceDataRepository.findByPoolAndTimeRange(
      poolAddress,
      startTime,
      endTime,
      sort,
      limit,
      offset
    );
    return docs.map(this.mapPriceDataToOutput);
  }

  private getMillisecondsForInterval(interval: OhlcInterval): number {
    switch (interval) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '30m': return 30 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '2h': return 2 * 60 * 60 * 1000;
      case '4h': return 4 * 60 * 60 * 1000;
      case '6h': return 6 * 60 * 60 * 1000;
      case '12h': return 12 * 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
      case '1w': return 7 * 24 * 60 * 60 * 1000;
      default: throw new ValidationError(`Unsupported interval: ${interval}`);
    }
  }

  async getOhlcPriceData(params: {
    poolAddress: string;
    interval: OhlcInterval;
    startTime: number;
    endTime: number;
    limit?: number;
  }): Promise<{
    timestamp: number;
    open: string;
    high: string;
    low: string;
    close: string;
  }[]> {
    const { poolAddress, interval, startTime, endTime, limit } = params;
    logger.debug(`Getting OHLC data for pool: ${poolAddress}, interval: ${interval}`, params);

    const intervalMs = this.getMillisecondsForInterval(interval);
    const intervalSeconds = intervalMs / 1000;

    const results = await this.priceDataRepository.aggregateOhlcData(
      poolAddress,
      intervalSeconds,
      startTime,
      endTime,
      limit
    );

    return results.map(bar => ({
      timestamp: bar.timestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));
  }
}