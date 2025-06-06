import { BaseBlockchainDaemon, BlockchainEvent, EventRouting } from "@shared/blockchain-daemon/src/baseBlockchain.daemon";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { MetricsService } from "../services/metrics.service";
import { logger } from "@shared/monitoring/src/logger";

/**
 * Loyalty service implementation of blockchain events daemon
 */
export class BlockchainEventsDaemon extends BaseBlockchainDaemon {
  constructor(
    rabbitClient: RabbitMQClient,
    private readonly metricsService: MetricsService
  ) {
    super(rabbitClient, "blockchain.events.loyalty");
  }

  protected getEventRouting(): EventRouting {
    return {
      "RWA_Deployed": async (event: BlockchainEvent) => {
        await this.metricsService.syncRWADeployed(event.data as any);
      },

      "Pool_Deployed": async (event: BlockchainEvent) => {
        await this.metricsService.syncPoolDeployed(event.data as any);
      },

      "Pool_RwaMinted": async (event: BlockchainEvent) => {
        await this.metricsService.syncPoolRwaMinted(event.data as any);
      },

      "Pool_RwaBurned": async (event: BlockchainEvent) => {
        await this.metricsService.syncPoolRwaBurned(event.data as any);
      },

      "Pool_TargetReached": async (event: BlockchainEvent) => {
        await this.metricsService.syncPoolTargetReached(event.data as any);
      },

      "Pool_FundsFullyReturned": async (event: BlockchainEvent) => {
        await this.metricsService.syncPoolFundsFullyReturned(event.data as any);
      },

      "Pool_IncomingTrancheUpdate": async (event: BlockchainEvent) => {
        await this.metricsService.syncPoolIncomingTrancheUpdate(event.data as any);
      },

      "Pool_OutgoingTrancheClaimed": async (event: BlockchainEvent) => {
        await this.metricsService.syncPoolOutgoingTrancheClaimed(event.data as any);
      },
    };
  }
}