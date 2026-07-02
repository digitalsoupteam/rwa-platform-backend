import { TokenBalanceRepository } from '../repositories/tokenBalance.repository';
import { TransactionRepository } from '../repositories/transaction.repository';
import type { ITokenBalanceEntity } from '../models/entity/tokenBalance.entity';
import type { ITransactionEntity } from '../models/entity/transaction.entity';
import type { SortOrder } from 'mongoose';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export class PortfolioService {
  constructor(
    private readonly tokenBalanceRepository: TokenBalanceRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  /**
   * Gets token balances list with filters, pagination and sorting
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ limit: a[0].limit, offset: a[0].offset }),
  })
  async getBalances(params: {
    filter?: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    const filter = params.filter ?? {};
    setSpanAttributes({
      wallet: filter.wallet,
      userId: filter.userId,
      chainId: filter.chainId,
      blockNumber: filter.blockNumber,
      transactionHash: filter.transactionHash,
      poolAddress: filter.poolAddress,
    });

    const balances = await this.tokenBalanceRepository.findAll(params.filter, params.sort, params.limit, params.offset);

    return balances.map(b => this.mapBalance(b));
  }

  /**
   * Gets transactions list with filters, pagination and sorting
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ limit: a[0].limit, offset: a[0].offset }),
  })
  async getTransactions(params: {
    filter?: Record<string, any>;
    sort?: { [key: string]: SortOrder };
    limit?: number;
    offset?: number;
  }) {
    const filter = params.filter ?? {};
    setSpanAttributes({
      wallet: filter.wallet ?? filter.from ?? filter.to,
      userId: filter.userId,
      chainId: filter.chainId,
      blockNumber: filter.blockNumber,
      transactionHash: filter.transactionHash,
      poolAddress: filter.poolAddress,
    });

    const transactions = await this.transactionRepository.findAll(
      params.filter,
      params.sort,
      params.limit,
      params.offset,
    );

    return transactions.map(tx => this.mapTransaction(tx));
  }

  /**
   * Process RWA transfer event
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({
      from: a[0].from,
      to: a[0].to,
      tokenAddress: a[0].tokenAddress,
      tokenId: a[0].tokenId,
      poolAddress: a[0].poolAddress,
      chainId: a[0].chainId,
      transactionHash: a[0].transactionHash,
      blockNumber: a[0].blockNumber,
      amount: a[0].amount,
    }),
  })
  async processTransfer(data: {
    from: string;
    to: string;
    tokenAddress: string;
    tokenId: string;
    poolAddress: string;
    chainId: string;
    transactionHash: string;
    blockNumber: number;
    amount: number;
  }) {
    setSpanAttributes({
      chainId: data.chainId,
      blockNumber: data.blockNumber,
      transactionHash: data.transactionHash,
      poolAddress: data.poolAddress,
    });

    // Skip if both addresses are zero (shouldn't happen)
    if (data.from === ZERO_ADDRESS && data.to === ZERO_ADDRESS) {
      return;
    }

    // Record transaction
    await this.transactionRepository.create({
      from: data.from,
      to: data.to,
      tokenAddress: data.tokenAddress,
      tokenId: data.tokenId,
      poolAddress: data.poolAddress,
      chainId: data.chainId,
      transactionHash: data.transactionHash,
      blockNumber: data.blockNumber,
      amount: data.amount,
    });

    if (data.from !== ZERO_ADDRESS) {
      await this.tokenBalanceRepository.updateBalance(
        data.from,
        data.tokenAddress,
        data.tokenId,
        data.poolAddress,
        data.chainId,
        -data.amount,
        data.blockNumber,
      );
    }

    if (data.to !== ZERO_ADDRESS) {
      await this.tokenBalanceRepository.updateBalance(
        data.to,
        data.tokenAddress,
        data.tokenId,
        data.poolAddress,
        data.chainId,
        data.amount,
        data.blockNumber,
      );
    }
  }

  private mapBalance(balance: ITokenBalanceEntity) {
    return {
      id: balance._id.toString(),
      owner: balance.owner,
      tokenAddress: balance.tokenAddress,
      tokenId: balance.tokenId,
      poolAddress: balance.poolAddress,
      chainId: balance.chainId,
      balance: balance.balance,
      lastUpdateBlock: balance.lastUpdateBlock,
      createdAt: balance.createdAt,
      updatedAt: balance.updatedAt,
    };
  }

  private mapTransaction(tx: ITransactionEntity) {
    return {
      id: tx._id.toString(),
      from: tx.from,
      to: tx.to,
      tokenAddress: tx.tokenAddress,
      poolAddress: tx.poolAddress,
      tokenId: tx.tokenId,
      chainId: tx.chainId,
      transactionHash: tx.transactionHash,
      blockNumber: tx.blockNumber,
      amount: tx.amount,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    };
  }
}
