import { BaseBlockchainDaemon, BlockchainEvent, EventRouting } from "@shared/blockchain-daemon/src/baseBlockchain.daemon";
import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { DaoService } from "../services/dao.service";
import { logger } from "@shared/monitoring/src/logger";

/**
 * DAO service implementation of blockchain events daemon
 */
export class BlockchainEventsDaemon extends BaseBlockchainDaemon {
  constructor(
    rabbitClient: RabbitMQClient,
    private readonly daoService: DaoService
  ) {
    super(rabbitClient, "blockchain.events.dao");
  }

  protected getEventRouting(): EventRouting {
    return {
      "Governance_ProposalCreated": async (event: BlockchainEvent) => {
        await this.daoService.processProposalCreated(event.data as any);
      },

      "Governance_ProposalExecuted": async (event: BlockchainEvent) => {
        await this.daoService.processProposalExecuted(event.data as any);
      },

      "Governance_ProposalCancelled": async (event: BlockchainEvent) => {
        await this.daoService.processProposalCancelled(event.data as any);
      },

      "Governance_VoteCast": async (event: BlockchainEvent) => {
        await this.daoService.processVoteCast(event.data as any);
      },

      "DaoStaking_TokensStaked": async (event: BlockchainEvent) => {
        await this.daoService.processTokensStaked(event.data as any);
      },

      "DaoStaking_TokensUnstaked": async (event: BlockchainEvent) => {
        await this.daoService.processTokensUnstaked(event.data as any);
      },

      "Timelock_TransactionQueued": async (event: BlockchainEvent) => {
        await this.daoService.processTransactionQueued(event.data as any);
      },

      "Timelock_TransactionExecuted": async (event: BlockchainEvent) => {
        await this.daoService.processTransactionExecuted(event.data as any);
      },

      "Timelock_TransactionCancelled": async (event: BlockchainEvent) => {
        await this.daoService.processTransactionCancelled(event.data as any);
      },

      "Treasury_Withdrawal": async (event: BlockchainEvent) => {
        await this.daoService.processTreasuryWithdrawal(event.data as any);
      }
    };
  }
}