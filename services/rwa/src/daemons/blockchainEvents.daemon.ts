import { BaseBlockchainDaemon, BlockchainEvent, EventRouting } from "@shared/blockchain-daemon/src/baseBlockchain.daemon";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { BusinessService } from "../services/business.service";
import { PoolService } from "../services/pool.service";
import { logger } from "@shared/monitoring/src/logger";

/**
 * RWA service implementation of blockchain events daemon
 */
export class BlockchainEventsDaemon extends BaseBlockchainDaemon {
  constructor(
    rabbitClient: RabbitMQClient,
    private readonly businessService: BusinessService,
    private readonly poolService: PoolService
  ) {
    super(rabbitClient, "blockchain.events.rwa");
  }

  protected getEventRouting(): EventRouting {
    return {
      "RWA_Deployed": async (event: BlockchainEvent) => {
        // Update business contract data
        await this.businessService.syncAfterDeployment(event.data as any);
      },

      "Pool_Deployed": async (event: BlockchainEvent) => {
        // Update pool info with all parameters from event
        await this.poolService.syncPoolAfterDeployment(event.data as any);
      }
    };
  }
}