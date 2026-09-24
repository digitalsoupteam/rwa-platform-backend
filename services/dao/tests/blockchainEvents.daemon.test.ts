/**
 * Unit tests for the DAO blockchain events daemon.
 *
 * Scope: the daemon's own wiring and routing only. The RabbitMQ client is an
 * in-memory fake that captures the consumer callback (tests drive synthetic
 * messages through it), and DaoService is replaced with a fake whose
 * interactions are asserted. The base daemon runs every handler inside
 * processEventExactlyOnce() — a MongoDB transaction plus a dedup-marker
 * insert — so the tests replace those two persistence primitives with
 * in-memory no-ops (see stubExactlyOncePersistence) and never touch a database.
 * Run with `bun test` from services/dao.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { AppError } from '@shared/errors/app-errors';
import type { BlockchainEvent } from '@shared/blockchain-daemon/src/baseBlockchain.daemon';
import type { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import type { DaoService } from '../src/services/dao.service';
import { BlockchainEventsDaemon } from '../src/daemons/blockchainEvents.daemon';
import {
  createFakeRabbitMQClient,
  type FakeConsumeMessage,
  type FakeRabbitMQClient,
} from './fakes/rabbitmq.client.fake';
import { createFakeDaoService, type FakeDaoService } from './fakes/dao.service.fake';

const QUEUE_NAME = 'blockchain.events.dao';
const EXCHANGE_NAME = 'blockchain.events';

/** Test double exposing the daemon's protected routing table. */
class TestableBlockchainEventsDaemon extends BlockchainEventsDaemon {
  getRouting() {
    return this.getEventRouting();
  }
}

/**
 * processEventExactlyOnce() opens a Mongo transaction and inserts a unique
 * processed-events marker before running the handler. Both are replaced here
 * with in-memory no-ops: the transaction becomes a passthrough and the marker
 * insert always succeeds, so the message pipeline stays database-free.
 */
function stubExactlyOncePersistence() {
  (mongoose.connection as any).transaction = async (fn: () => Promise<unknown>) => {
    await fn();
  };

  (mongoose.models as any)['ProcessedEvent'] = {
    create: async () => ({}),
  };
}

function blockchainEvent(name: string, data: Record<string, unknown>): BlockchainEvent {
  return {
    chainId: 1,
    name,
    blockNumber: 123456,
    transactionHash: '0xbigeventtx',
    address: '0xGovernance',
    logIndex: 0,
    data,
    timestamp: 1_700_000_000,
  };
}

/** Message as delivered by the broker: the event JSON in `content`. */
function messageFor(event: BlockchainEvent): FakeConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(event)),
    fields: { deliveryTag: 1 },
    properties: { headers: {} },
  };
}

const PROPOSAL_CREATED_DATA = {
  emittedFrom: '0xGovernance',
  proposalId: '7',
  proposer: '0xAlice',
  target: '0xTreasury',
  data: '0xdeadbeef',
  description: 'Raise the staking cap',
  startTime: 1_700_000_000,
  endTime: 1_700_086_400,
  chainId: '1',
  transactionHash: '0xtx1',
  logIndex: 0,
};

const VOTE_CAST_DATA = {
  emittedFrom: '0xGovernance',
  proposalId: '7',
  voter: '0xCarol',
  support: true,
  weight: '123.45',
  reason: 'Good proposal',
  chainId: '1',
  transactionHash: '0xtx3',
  logIndex: 0,
  blockNumber: 42,
};

const STAKING_DATA = {
  emittedFrom: '0xStaking',
  staker: '0xBob',
  amount: '250',
  newVotingPower: '250',
  chainId: '1',
  transactionHash: '0xtx4',
  logIndex: 1,
};

const TIMELOCK_DATA = {
  emittedFrom: '0xTimelock',
  txHash: '0xtimelock1',
  target: '0xTreasury',
  data: '0xdeadbeef',
  eta: 1_700_090_000,
  chainId: '1',
  transactionHash: '0xtx6',
  logIndex: 3,
};

const TREASURY_WITHDRAWAL_DATA = {
  emittedFrom: '0xTreasury',
  to: '0xBob',
  token: '0xToken',
  amount: '500',
  chainId: '1',
  transactionHash: '0xtx8',
  logIndex: 5,
};

describe('BlockchainEventsDaemon (unit, fake rabbit client and fake service)', () => {
  let rabbit: FakeRabbitMQClient;
  let daoService: FakeDaoService;
  let daemon: TestableBlockchainEventsDaemon;

  beforeEach(() => {
    stubExactlyOncePersistence();
    rabbit = createFakeRabbitMQClient();
    daoService = createFakeDaoService();
    daemon = new TestableBlockchainEventsDaemon(
      rabbit as unknown as RabbitMQClient,
      daoService as unknown as DaoService,
    );
  });

  test('initialize: declares the dao topology and starts consuming the dao queue', async () => {
    await daemon.initialize();

    expect(rabbit.setupExchange).toHaveBeenCalledWith(EXCHANGE_NAME, 'direct', { durable: true });
    expect(rabbit.setupExchange).toHaveBeenCalledWith(`${QUEUE_NAME}.retry.exchange`, 'direct', { durable: true });

    expect(rabbit.setupQueue).toHaveBeenCalledWith(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': `${QUEUE_NAME}.retry.exchange`,
        'x-dead-letter-routing-key': `${QUEUE_NAME}.retry`,
      },
    });
    expect(rabbit.setupQueue).toHaveBeenCalledWith(`${QUEUE_NAME}.retry`, {
      durable: true,
      arguments: {
        'x-message-ttl': 10_000,
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': QUEUE_NAME,
      },
    });
    expect(rabbit.setupQueue).toHaveBeenCalledWith(`${QUEUE_NAME}.parked`, { durable: true });

    // One binding per routed event, plus the retry binding.
    expect(rabbit.bindQueue).toHaveBeenCalledTimes(11);
    for (const eventName of Object.keys(daemon.getRouting())) {
      expect(rabbit.bindQueue).toHaveBeenCalledWith(QUEUE_NAME, EXCHANGE_NAME, eventName);
    }
    expect(rabbit.bindQueue).toHaveBeenCalledWith(
      `${QUEUE_NAME}.retry`,
      `${QUEUE_NAME}.retry.exchange`,
      `${QUEUE_NAME}.retry`,
    );

    expect(rabbit.consume).toHaveBeenCalledWith(QUEUE_NAME, expect.any(Function), { noAck: false, prefetch: 1 });
    expect(rabbit.consumerFor(QUEUE_NAME)).toBeInstanceOf(Function);
  });

  test('getEventRouting: covers exactly the DAO contract events', () => {
    const routing = daemon.getRouting();

    expect(Object.keys(routing).sort()).toEqual([
      'DaoStaking_TokensStaked',
      'DaoStaking_TokensUnstaked',
      'Governance_ProposalCancelled',
      'Governance_ProposalCreated',
      'Governance_ProposalExecuted',
      'Governance_VoteCast',
      'Timelock_TransactionCancelled',
      'Timelock_TransactionExecuted',
      'Timelock_TransactionQueued',
      'Treasury_Withdrawal',
    ]);
  });

  test('Governance_ProposalCreated routes to processProposalCreated', async () => {
    const event = blockchainEvent('Governance_ProposalCreated', PROPOSAL_CREATED_DATA);

    await daemon.getRouting()[event.name](event);

    expect(daoService.processProposalCreated).toHaveBeenCalledTimes(1);
    expect(daoService.processProposalCreated).toHaveBeenCalledWith(event.data);
    // Only the routed handler runs.
    expect(daoService.processProposalExecuted).not.toHaveBeenCalled();
    expect(daoService.processVoteCast).not.toHaveBeenCalled();
  });

  test('Governance_ProposalExecuted routes to processProposalExecuted', async () => {
    const event = blockchainEvent('Governance_ProposalExecuted', {
      emittedFrom: '0xGovernance',
      proposalId: '7',
      executor: '0xAlice',
      chainId: '1',
      transactionHash: '0xtx2',
      logIndex: 1,
    });

    await daemon.getRouting()[event.name](event);

    expect(daoService.processProposalExecuted).toHaveBeenCalledTimes(1);
    expect(daoService.processProposalExecuted).toHaveBeenCalledWith(event.data);
  });

  test('Governance_ProposalCancelled routes to processProposalCancelled', async () => {
    const event = blockchainEvent('Governance_ProposalCancelled', {
      emittedFrom: '0xGovernance',
      proposalId: '7',
      canceller: '0xAlice',
      chainId: '1',
      transactionHash: '0xtx3',
      logIndex: 2,
    });

    await daemon.getRouting()[event.name](event);

    expect(daoService.processProposalCancelled).toHaveBeenCalledTimes(1);
    expect(daoService.processProposalCancelled).toHaveBeenCalledWith(event.data);
  });

  test('Governance_VoteCast routes to processVoteCast', async () => {
    const event = blockchainEvent('Governance_VoteCast', VOTE_CAST_DATA);

    await daemon.getRouting()[event.name](event);

    expect(daoService.processVoteCast).toHaveBeenCalledTimes(1);
    expect(daoService.processVoteCast).toHaveBeenCalledWith(event.data);
  });

  test('DaoStaking_TokensStaked routes to processTokensStaked', async () => {
    const event = blockchainEvent('DaoStaking_TokensStaked', STAKING_DATA);

    await daemon.getRouting()[event.name](event);

    expect(daoService.processTokensStaked).toHaveBeenCalledTimes(1);
    expect(daoService.processTokensStaked).toHaveBeenCalledWith(event.data);
  });

  test('DaoStaking_TokensUnstaked routes to processTokensUnstaked', async () => {
    const event = blockchainEvent('DaoStaking_TokensUnstaked', STAKING_DATA);

    await daemon.getRouting()[event.name](event);

    expect(daoService.processTokensUnstaked).toHaveBeenCalledTimes(1);
    expect(daoService.processTokensUnstaked).toHaveBeenCalledWith(event.data);
  });

  test('Timelock_TransactionQueued routes to processTransactionQueued', async () => {
    const event = blockchainEvent('Timelock_TransactionQueued', TIMELOCK_DATA);

    await daemon.getRouting()[event.name](event);

    expect(daoService.processTransactionQueued).toHaveBeenCalledTimes(1);
    expect(daoService.processTransactionQueued).toHaveBeenCalledWith(event.data);
  });

  test('Timelock_TransactionExecuted routes to processTransactionExecuted', async () => {
    const event = blockchainEvent('Timelock_TransactionExecuted', TIMELOCK_DATA);

    await daemon.getRouting()[event.name](event);

    expect(daoService.processTransactionExecuted).toHaveBeenCalledTimes(1);
    expect(daoService.processTransactionExecuted).toHaveBeenCalledWith(event.data);
  });

  test('Timelock_TransactionCancelled routes to processTransactionCancelled', async () => {
    const event = blockchainEvent('Timelock_TransactionCancelled', TIMELOCK_DATA);

    await daemon.getRouting()[event.name](event);

    expect(daoService.processTransactionCancelled).toHaveBeenCalledTimes(1);
    expect(daoService.processTransactionCancelled).toHaveBeenCalledWith(event.data);
  });

  test('Treasury_Withdrawal routes to processTreasuryWithdrawal', async () => {
    const event = blockchainEvent('Treasury_Withdrawal', TREASURY_WITHDRAWAL_DATA);

    await daemon.getRouting()[event.name](event);

    expect(daoService.processTreasuryWithdrawal).toHaveBeenCalledTimes(1);
    expect(daoService.processTreasuryWithdrawal).toHaveBeenCalledWith(event.data);
  });

  test('consume callback: an event without a handler is acknowledged and ignored', async () => {
    await daemon.initialize();
    const consumer = rabbit.consumerFor(QUEUE_NAME)!;

    const message = messageFor(blockchainEvent('Some_UnknownEvent', { anything: true }));

    await consumer(message);

    expect(rabbit.ack).toHaveBeenCalledTimes(1);
    expect(rabbit.ack).toHaveBeenCalledWith(message);
    expect(rabbit.nack).not.toHaveBeenCalled();
    for (const method of Object.values(daoService)) expect(method).not.toHaveBeenCalled();
  });

  test('consume callback: a routed event reaches the service and is acknowledged', async () => {
    await daemon.initialize();
    const consumer = rabbit.consumerFor(QUEUE_NAME)!;

    const event = blockchainEvent('Governance_VoteCast', VOTE_CAST_DATA);
    const message = messageFor(event);

    await consumer(message);

    expect(daoService.processVoteCast).toHaveBeenCalledTimes(1);
    expect(daoService.processVoteCast).toHaveBeenCalledWith(event.data);
    expect(rabbit.ack).toHaveBeenCalledWith(message);
    expect(rabbit.nack).not.toHaveBeenCalled();
  });

  test('consume callback: a service failure is not acknowledged and is dead-lettered for retry', async () => {
    await daemon.initialize();
    const consumer = rabbit.consumerFor(QUEUE_NAME)!;

    daoService.processVoteCast.mockImplementationOnce(async () => {
      throw new AppError({ message: 'Vote write failed', statusCode: 500, code: 'INTERNAL_ERROR' });
    });

    const message = messageFor(blockchainEvent('Governance_VoteCast', VOTE_CAST_DATA));

    await consumer(message);

    expect(daoService.processVoteCast).toHaveBeenCalledTimes(1);
    expect(rabbit.ack).not.toHaveBeenCalled();
    // Non-transient failure with no retries recorded yet: nack without requeue,
    // the broker dead-letters it to the retry queue.
    expect(rabbit.nack).toHaveBeenCalledTimes(1);
    expect(rabbit.nack).toHaveBeenCalledWith(message, false);
  });
});
