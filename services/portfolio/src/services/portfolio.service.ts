import { logger } from "@shared/monitoring/src/logger";
import { TokenBalanceRepository } from "../repositories/tokenBalance.repository";
import { TransactionRepository } from "../repositories/transaction.repository";
import { ITokenBalanceEntity } from "../models/entity/tokenBalance.entity";
import { ITransactionEntity } from "../models/entity/transaction.entity";
import { SortOrder } from "mongoose";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export class PortfolioService {
  constructor(
    private readonly tokenBalanceRepository: TokenBalanceRepository,
    private readonly transactionRepository: TransactionRepository
  ) { }

  /**
   * Gets token balances list with filters, pagination and sorting
   */
  async getBalances(params: {
    filter?: Record<string, any>,
    sort?: { [key: string]: SortOrder },
    limit?: number,
    offset?: number
  }) {
    logger.debug("Getting token balances list", params);
    
    const balances = await this.tokenBalanceRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return balances.map(this.mapBalance);
  }

  /**
   * Gets transactions list with filters, pagination and sorting
   */
  async getTransactions(params: {
    filter?: Record<string, any>,
    sort?: { [key: string]: SortOrder },
    limit?: number,
    offset?: number
  }) {
    logger.debug("Getting transactions list", params);
    
    const transactions = await this.transactionRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset
    );

    return transactions.map(this.mapTransaction);
  }

  /**
   * Process RWA transfer event
   */
  async processTransfer(data: {
    from: string;
    to: string;
    tokenAddress: string;
    tokenId: string;
    pool: string;
    chainId: string;
    transactionHash: string;
    blockNumber: number;
    amount: number;
  }) {
    logger.debug("Processing transfer", data);

    // Skip if both addresses are zero (shouldn't happen)
    if (data.from === ZERO_ADDRESS && data.to === ZERO_ADDRESS) {
      logger.warn("Invalid transfer: both addresses are zero", data);
      return;
    }

    // Record transaction
    await this.transactionRepository.create({
      from: data.from,
      to: data.to,
      tokenAddress: data.tokenAddress,
      tokenId: data.tokenId,
      pool: data.pool,
      chainId: data.chainId,
      transactionHash: data.transactionHash,
      blockNumber: data.blockNumber,
      amount: data.amount
    });

    if (data.from !== ZERO_ADDRESS) {
      await this.tokenBalanceRepository.updateBalance(
        data.from,
        data.tokenAddress,
        data.tokenId,
        data.pool,
        data.chainId,
        -data.amount,
        data.blockNumber
      );
    }

    if (data.to !== ZERO_ADDRESS) {
      await this.tokenBalanceRepository.updateBalance(
        data.to,
        data.tokenAddress,
        data.tokenId,
        data.pool,
        data.chainId,
        data.amount,
        data.blockNumber
      );
    }
  }

  private mapBalance(balance: ITokenBalanceEntity) {
    return {
      id: balance._id.toString(),
      owner: balance.owner,
      tokenAddress: balance.tokenAddress,
      tokenId: balance.tokenId,
      pool: balance.pool,
      chainId: balance.chainId,
      balance: balance.balance,
      lastUpdateBlock: balance.lastUpdateBlock,
      createdAt: balance.createdAt,
      updatedAt: balance.updatedAt
    };
  }

  private mapTransaction(tx: ITransactionEntity) {
    return {
      id: tx._id.toString(),
      from: tx.from,
      to: tx.to,
      tokenAddress: tx.tokenAddress,
      pool: tx.pool,
      tokenId: tx.tokenId,
      chainId: tx.chainId,
      transactionHash: tx.transactionHash,
      blockNumber: tx.blockNumber,
      amount: tx.amount,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt
    };
  }
}