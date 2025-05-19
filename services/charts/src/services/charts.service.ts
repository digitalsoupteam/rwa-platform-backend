import { logger } from "@shared/monitoring/src/logger";
import { PriceDataRepository } from "../repositories/priceData.repository";
import { IPriceDataEntity, PriceDataEntity } from "../models/entity/priceData.entity";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { ValidationError, NotFoundError } from "@shared/errors/app-errors";

// Define precision constants for BigInt calculations
const CALCULATION_PRECISION_DIGITS = 36; // Number of digits for intermediate calculation precision
const CALCULATION_PRECISION_FACTOR = 10n ** BigInt(CALCULATION_PRECISION_DIGITS);
const STORED_PRICE_DECIMALS = 18; // Number of decimal places to store in the price string

/**
 * Formats a BigInt (representing a scaled number) into a decimal string.
 * @param scaledValue The BigInt value, scaled by `inputPrecisionFactor`.
 * @param inputPrecisionDigits The number of virtual decimal places in `scaledValue`.
 * @param outputDecimalPlaces The desired number of decimal places in the output string.
 * @returns A string representation of the number with `outputDecimalPlaces`.
 */
function formatBigIntToDecimalString(
  scaledValue: bigint,
  inputPrecisionDigits: number,
  outputDecimalPlaces: number
): string {
  const valueStr = scaledValue.toString();
  const isNegative = valueStr.startsWith('-');
  const absValueStr = isNegative ? valueStr.substring(1) : valueStr;

  let integerPartStr = "0";
  let fractionalPartStr = "";

  if (absValueStr.length > inputPrecisionDigits) {
    integerPartStr = absValueStr.slice(0, absValueStr.length - inputPrecisionDigits);
    fractionalPartStr = absValueStr.slice(absValueStr.length - inputPrecisionDigits);
  } else {
    fractionalPartStr = absValueStr.padStart(inputPrecisionDigits, '0');
  }

  // Trim or pad the fractional part to the desired output decimal places
  if (fractionalPartStr.length > outputDecimalPlaces) {
    fractionalPartStr = fractionalPartStr.slice(0, outputDecimalPlaces);
  } else {
    fractionalPartStr = fractionalPartStr.padEnd(outputDecimalPlaces, '0');
  }

  return `${isNegative ? '-' : ''}${integerPartStr}.${fractionalPartStr}`;
}


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

    // Calculate price using BigInt for precision
    const virtualHoldReserveBigInt = BigInt(data.virtualHoldReserve);
    const scaledNumerator = virtualHoldReserveBigInt * CALCULATION_PRECISION_FACTOR;
    const scaledPrice = scaledNumerator / virtualRwaReserveBigInt; // This is a BigInt

    const priceString = formatBigIntToDecimalString(
      scaledPrice,
      CALCULATION_PRECISION_DIGITS,
      STORED_PRICE_DECIMALS
    );

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