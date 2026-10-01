import { BaseBlockchainDaemon } from '@shared/blockchain-daemon/src/baseBlockchain.daemon';
import type {
  BlockchainDaemonRetryOptions,
  BlockchainEvent,
  EventRouting,
} from '@shared/blockchain-daemon/src/baseBlockchain.daemon';
import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { DaoService } from '../services/dao.service';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

/**
 * DAO service implementation of blockchain events daemon
 *
 * Handlers forward the full blockchain event to the service: decoded contract
 * fields live in `event.data`, the envelope (chainId, transactionHash, logIndex,
 * blockNumber) sits on the root.
 */

export class BlockchainEventsDaemon extends BaseBlockchainDaemon {
  constructor(
    rabbitClient: RabbitMQClient,
    private readonly daoService: DaoService,
    retryOptions?: BlockchainDaemonRetryOptions,
  ) {
    super(rabbitClient, 'blockchain.events.dao', retryOptions);
  }

  @TraceDecorator()
  protected getEventRouting(): EventRouting {
    return {
      Governance_ProposalCreated: async (event: BlockchainEvent) => {
        await this.daoService.processProposalCreated(event as any);
      },

      Governance_ProposalExecuted: async (event: BlockchainEvent) => {
        await this.daoService.processProposalExecuted(event as any);
      },

      Governance_ProposalCancelled: async (event: BlockchainEvent) => {
        await this.daoService.processProposalCancelled(event as any);
      },

      Governance_VoteCast: async (event: BlockchainEvent) => {
        await this.daoService.processVoteCast(event as any);
      },

      DaoStaking_TokensStaked: async (event: BlockchainEvent) => {
        await this.daoService.processTokensStaked(event as any);
      },

      DaoStaking_TokensUnstaked: async (event: BlockchainEvent) => {
        await this.daoService.processTokensUnstaked(event as any);
      },

      DaoStaking_TokensLocked: async (event: BlockchainEvent) => {
        await this.daoService.processTokensLocked(event as any);
      },

      Timelock_TransactionQueued: async (event: BlockchainEvent) => {
        await this.daoService.processTransactionQueued(event as any);
      },

      Timelock_TransactionExecuted: async (event: BlockchainEvent) => {
        await this.daoService.processTransactionExecuted(event as any);
      },

      Timelock_TransactionCancelled: async (event: BlockchainEvent) => {
        await this.daoService.processTransactionCancelled(event as any);
      },

      Treasury_Withdrawal: async (event: BlockchainEvent) => {
        await this.daoService.processTreasuryWithdrawal(event as any);
      },
    };
  }
}
