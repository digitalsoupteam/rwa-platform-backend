import { logger } from "@shared/monitoring/src/logger";
import { PriceDataRepository } from "../repositories/priceData.repository";
import { IPriceDataEntity, PriceDataEntity } from "../models/entity/priceData.entity";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { ValidationError, NotFoundError } from "@shared/errors/app-errors";

// Precision constants CALCULATION_PRECISION_DIGITS and CALCULATION_PRECISION_FACTOR are removed.
// Price will be calculated using integer division of BigInts.
// The string representation of this integer result will be stored.

// The function formatBigIntToDecimalString is removed.
// Consumers of the price string (which is now a simple integer string)
// will use it directly or perform further client-side formatting if needed.

export type OhlcInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' | '1w';

export class ChartsService {
  constructor(private readonly priceDataRepository: PriceDataRepository) {}

  private mapPriceDataToOutput(doc: IPriceDataEntity): Omit<IPriceDataEntity, '_id'> & { id: string } {
    return {
      id: doc._id.toString(),
      poolAddress: doc.poolAddress,
      timestamp: doc.timestamp,
      blockNumber: doc.blockNumber,
      realHoldReserve: doc.realHoldReserve,
      virtualHoldReserve: doc.virtualHoldReserve,
      virtualRwaReserve: doc.virtualRwaReserve,
      price: doc.price, // Price is already a formatted string
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async recordPriceData(data: {
    poolAddress: string;
    timestamp: number; // Unix timestamp (seconds)
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

    // Calculate price using BigInt integer division
    // price = (virtualHoldReserve + realHoldReserve) / virtualRwaReserve
    const virtualHoldReserveBigInt = BigInt(data.virtualHoldReserve);
    const realHoldReserveBigInt = BigInt(data.realHoldReserve);

    const numerator = virtualHoldReserveBigInt + realHoldReserveBigInt;
    // Perform integer division. Any fractional part will be truncated.
    const calculatedPriceBigInt = numerator / virtualRwaReserveBigInt;

    // Store the BigInt result as a string
    const priceString = calculatedPriceBigInt.toString();

    const newPriceEntry: Omit<IPriceDataEntity, '_id' | 'createdAt' | 'updatedAt'> = {
      poolAddress: data.poolAddress,
      timestamp: data.timestamp,
      blockNumber: data.blockNumber,
      realHoldReserve: data.realHoldReserve,
      virtualHoldReserve: data.virtualHoldReserve,
      virtualRwaReserve: data.virtualRwaReserve,
      price: priceString, // String representation of the integer BigInt price
    };

    const createdDoc = await this.priceDataRepository.create(newPriceEntry);
    return this.mapPriceDataToOutput(createdDoc);
  }

  async getRawPriceData(params: {
    poolAddress: string;
    startTime: number; // Unix timestamp (seconds)
    endTime: number;   // Unix timestamp (seconds)
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
    startTime: number; // Unix timestamp (seconds)
    endTime: number;   // Unix timestamp (seconds)
    limit?: number; // Optional limit for the number of OHLC bars
  }): Promise<{
    timestamp: number; // Start of the interval (Unix timestamp seconds)
    open: string;
    high: string;
    low: string;
    close: string;
  }[]> {
    const { poolAddress, interval, startTime, endTime, limit } = params;
    logger.debug(`Getting OHLC data for pool: ${poolAddress}, interval: ${interval}`, params);

    const intervalMs = this.getMillisecondsForInterval(interval);
    const intervalSeconds = intervalMs / 1000;

    // Call the repository method for aggregation
    const results = await this.priceDataRepository.aggregateOhlcData(
      poolAddress,
      intervalSeconds,
      startTime,
      endTime,
      limit
    );
    
    return results; // The repository now returns the data in the correct format
  }
}