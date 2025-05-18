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
      },

      "Pool_AwaitingBonusAmountUpdated": async (event: BlockchainEvent) => {
        await this.poolService.syncPoolAwaitingBonusAmount(event.data as any);
      },

      "Pool_AwaitingRwaAmountUpdated": async (event: BlockchainEvent) => {
        await this.poolService.syncPoolAwaitingRwaAmount(event.data as any);
      },

      "Pool_FundsFullyReturned": async (event: BlockchainEvent) => {
        await this.poolService.syncPoolFundsFullyReturned(event.data as any);
      },

      "Pool_IncomingReturnSummary": async (event: BlockchainEvent) => {
        await this.poolService.syncPoolIncomingReturnSummary(event.data as any);
      },

      "Pool_IncomingTrancheUpdate": async (event: BlockchainEvent) => {
        await this.poolService.syncPoolIncomingTrancheUpdate(event.data as any);
      },

      "Pool_OutgoingClaimSummary": async (event: BlockchainEvent) => {
        await this.poolService.syncPoolOutgoingClaimSummary(event.data as any);
      },

      "Pool_OutgoingTrancheClaimed": async (event: BlockchainEvent) => {
        await this.poolService.syncPoolOutgoingTrancheClaimed(event.data as any);
      },

      "Pool_PausedStateChanged": async (event: BlockchainEvent) => {
        await this.poolService.syncPoolPausedState(event.data as any);
      },

      "Pool_ReservesUpdated": async (event: BlockchainEvent) => {
        await this.poolService.syncPoolReserves(event.data as any);
      },

      "Pool_TargetReached": async (event: BlockchainEvent) => {
        await this.poolService.syncPoolTargetReached(event.data as any);
      }
    };
  }
}