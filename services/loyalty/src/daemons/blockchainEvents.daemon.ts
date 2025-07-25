import { BaseBlockchainDaemon, BlockchainEvent, EventRouting } from "@shared/blockchain-daemon/src/baseBlockchain.daemon";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { LoyaltyService } from "../services/loyalty.service";
import { logger } from "@shared/monitoring/src/logger";

/**
 * Loyalty service implementation of blockchain events daemon
 */
export class BlockchainEventsDaemon extends BaseBlockchainDaemon {
  constructor(
    rabbitClient: RabbitMQClient,
    private readonly loyaltyService: LoyaltyService
  ) {
    super(rabbitClient, "blockchain.events.loyalty");
  }

  protected getEventRouting(): EventRouting {
    return {
      "Factory_CreateRWAFeeCollected": async (event: BlockchainEvent) => {
        await this.loyaltyService.processCreateRWAFeeCollected(event as any);
      },

      "Factory_CreatePoolFeeCollected": async (event: BlockchainEvent) => {
        await this.loyaltyService.processCreatePoolFeeCollected(event as any);
      },

      "Pool_RwaMinted": async (event: BlockchainEvent) => {
        await this.loyaltyService.processRwaMinted(event as any);
      },

      "Pool_RwaBurned": async (event: BlockchainEvent) => {
        await this.loyaltyService.processRwaBurned(event as any);
      },

      "ReferralTreasury_Withdrawn": async (event: BlockchainEvent) => {
        await this.loyaltyService.processReferralTreasuryWithdrawn(event as any);
      }
    };
  }
}