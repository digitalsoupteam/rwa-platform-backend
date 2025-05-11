import { BaseBlockchainDaemon, BlockchainEvent, EventRouting } from "@shared/blockchain-daemon/src/baseBlockchain.daemon";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { PortfolioService } from "../services/portfolio.service";
import { logger } from "@shared/monitoring/src/logger";

/**
 * Portfolio service implementation of blockchain events daemon
 */
export class BlockchainEventsDaemon extends BaseBlockchainDaemon {
  constructor(
    rabbitClient: RabbitMQClient,
    private readonly portfolioService: PortfolioService
  ) {
    super(rabbitClient, "blockchain.events.portfolio");
  }

  protected getEventRouting(): EventRouting {
    return {
      "RWA_Transfer": async (event: BlockchainEvent) => {
        const { 
          emittedFrom, // rwa address
          from,
          to,
          tokenId,
          amount
        } = event.data;

        
        await this.portfolioService.processTransfer({
          from,
          to,
          tokenAddress: emittedFrom,
          tokenId,
          chainId: `${event.chainId}`,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          amount: Number(amount)
        });

        logger.info(`Processed swap event for user`, {
          emittedFrom, 
          from,
          to,
          tokenId,
          amount
        });
      }
    };
  }
}