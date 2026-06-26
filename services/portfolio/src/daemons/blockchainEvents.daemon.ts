import { BaseBlockchainDaemon } from '@shared/blockchain-daemon/src/baseBlockchain.daemon';
import type { BlockchainEvent } from '@shared/blockchain-daemon/src/baseBlockchain.daemon';
import type { EventRouting } from '@shared/blockchain-daemon/src/baseBlockchain.daemon';
import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { PortfolioService } from '../services/portfolio.service';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

/**
 * Portfolio service implementation of blockchain events daemon
 */

export class BlockchainEventsDaemon extends BaseBlockchainDaemon {
  constructor(
    rabbitClient: RabbitMQClient,
    private readonly portfolioService: PortfolioService,
  ) {
    super(rabbitClient, 'blockchain.events.portfolio');
  }

  @TraceDecorator()
  protected getEventRouting(): EventRouting {
    return {
      RWA_Transfer: async (event: BlockchainEvent) => {
        const {
          emittedFrom, // rwa address
          from,
          to,
          tokenId,
          amount,
          pool,
        } = event.data;

        await this.portfolioService.processTransfer({
          from,
          to,
          tokenAddress: emittedFrom,
          tokenId,
          chainId: `${event.chainId}`,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          amount: Number(amount),
          poolAddress: pool,
        });
      },
    };
  }
}
