import { BaseBlockchainDaemon, BlockchainEvent, EventRouting } from "@shared/blockchain-daemon/src/baseBlockchain.daemon";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { ChartsService } from "../services/charts.service";
import { TransactionsService } from "../services/transactions.service";
import { logger } from "@shared/monitoring/src/logger";
import { PoolTransactionType } from "../models/entity/poolTransaction.entity";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class BlockchainEventsDaemon extends BaseBlockchainDaemon {
  constructor(
    rabbitClient: RabbitMQClient,
    private readonly chartsService: ChartsService,
    private readonly transactionsService: TransactionsService
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
      },
      "Pool_RwaMinted": async (event: BlockchainEvent) => {
        const { emittedFrom, minter, rwaAmountMinted, holdAmountPaid, feePaid } = event.data as any;
        
        await this.transactionsService.recordTransaction({
          poolAddress: emittedFrom,
          transactionType: PoolTransactionType.MINT,
          userAddress: minter,
          timestamp: event.timestamp,
          rwaAmount: rwaAmountMinted.toString(),
          holdAmount: holdAmountPaid.toString(),
          holdFee: feePaid.toString()
        });
      },
      "Pool_RwaBurned": async (event: BlockchainEvent) => {
        const { emittedFrom, burner, rwaAmountBurned, holdAmountReceived, bonusAmountReceived, holdFeePaid, bonusFeePaid } = event.data as any;
        
        await this.transactionsService.recordTransaction({
          poolAddress: emittedFrom,
          transactionType: PoolTransactionType.BURN,
          userAddress: burner,
          timestamp: event.timestamp,
          rwaAmount: rwaAmountBurned.toString(),
          holdAmount: holdAmountReceived.toString(),
          bonusAmount: bonusAmountReceived.toString(),
          holdFee: holdFeePaid.toString(),
          bonusFee: bonusFeePaid.toString()
        });
      }
    };
  }
}