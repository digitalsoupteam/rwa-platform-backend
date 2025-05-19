import { BaseBlockchainDaemon, BlockchainEvent, EventRouting } from "@shared/blockchain-daemon/src/baseBlockchain.daemon";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { ChartsService } from "../services/charts.service";
import { logger } from "@shared/monitoring/src/logger";

/**
 * Charts service implementation of blockchain events daemon
 */
export class BlockchainEventsDaemon extends BaseBlockchainDaemon {
  constructor(
    rabbitClient: RabbitMQClient,
    private readonly chartsService: ChartsService
  ) {
    super(rabbitClient, "blockchain.events.charts");
  }

  protected getEventRouting(): EventRouting {
    return {
      "Pool_ReservesUpdated": async (event: BlockchainEvent) => {
        const { emittedFrom, realHoldReserve, virtualHoldReserve, virtualRwaReserve } = event.data as any;
        
        await this.chartsService.recordPriceData({
          poolAddress: emittedFrom,
          timestamp: event.timestamp,
          blockNumber: event.blockNumber,
          realHoldReserve: realHoldReserve.toString(),
          virtualHoldReserve: virtualHoldReserve.toString(),
          virtualRwaReserve: virtualRwaReserve.toString()
        });
      }
    };
  }
}