import { logger } from "@shared/monitoring/src/logger";
import { ValidationError } from "@shared/errors/app-errors";
import { PoolTransactionRepository } from "../repositories/poolTransaction.repository";
import { IPoolTransactionEntity, PoolTransactionType } from "../models/entity/poolTransaction.entity";
import { FilterQuery, SortOrder } from "mongoose";
import { ChartEventsClient } from "../clients/redis.client";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class TransactionsService {
  constructor(
    private readonly poolTransactionRepository: PoolTransactionRepository,
    private readonly chartEventsClient: ChartEventsClient
  ) {}

  async recordTransaction(data: {
    poolAddress: string;
    transactionType: PoolTransactionType;
    userAddress: string;
    timestamp: number;
    rwaAmount: string;
    holdAmount: string;
    bonusAmount?: string;
    holdFee: string;
    bonusFee?: string;
  }) {
    logger.info(`Recording transaction for pool: ${data.poolAddress}, type: ${data.transactionType}`);

    const transaction = await this.poolTransactionRepository.create({
      ...data,
      bonusAmount: data.bonusAmount || "0",
      bonusFee: data.bonusFee || "0"
    });

    const output = {
      id: transaction._id.toString(),
      poolAddress: transaction.poolAddress,
      transactionType: transaction.transactionType,
      userAddress: transaction.userAddress,
      timestamp: transaction.timestamp,
      rwaAmount: transaction.rwaAmount,
      holdAmount: transaction.holdAmount,
      bonusAmount: transaction.bonusAmount,
      holdFee: transaction.holdFee,
      bonusFee: transaction.bonusFee,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    };

    await this.chartEventsClient.publishTransactionUpdate({
      poolAddress: output.poolAddress,
      timestamp: output.timestamp,
      transactionType: output.transactionType,
      userAddress: output.userAddress,
      rwaAmount: output.rwaAmount,
      holdAmount: output.holdAmount,
      bonusAmount: output.bonusAmount,
      holdFee: output.holdFee,
      bonusFee: output.bonusFee,
    });

    return output;
  }

  async getTransactions(params: {
    filter: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    logger.debug('Getting transactions list', params);
    
    const transactions = await this.poolTransactionRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return transactions.map(tx => ({
      id: tx._id.toString(),
      poolAddress: tx.poolAddress,
      transactionType: tx.transactionType,
      userAddress: tx.userAddress,
      timestamp: tx.timestamp,
      rwaAmount: tx.rwaAmount,
      holdAmount: tx.holdAmount,
      bonusAmount: tx.bonusAmount,
      holdFee: tx.holdFee,
      bonusFee: tx.bonusFee,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt
    }));
  }

  async getVolumeData(params: {
    poolAddress: string;
    interval: string;
    startTime: number;
    endTime: number;
    limit?: number;
  }) {
    logger.debug('Getting volume data', params);
    
    const intervalMap: { [key: string]: number } = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '6h': 21600,
      '12h': 43200,
      '1d': 86400,
      '1w': 604800
    };

    const intervalSeconds = intervalMap[params.interval];
    if (!intervalSeconds) {
      throw new ValidationError(`Unsupported interval: ${params.interval}`);
    }

    return await this.poolTransactionRepository.aggregateVolumeData(
      params.poolAddress,
      intervalSeconds,
      params.startTime,
      params.endTime,
      params.limit
    );
  }
}