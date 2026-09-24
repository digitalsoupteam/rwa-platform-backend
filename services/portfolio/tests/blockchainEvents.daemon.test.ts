/**
 * Unit tests for BlockchainEventsDaemon.
 *
 * The daemon is subclassed in-test to expose its protected routing table, and
 * its RabbitMQ client is replaced with an in-memory fake
 * (tests/fakes/rabbitmq.client.fake.ts): no broker, no database, no network.
 * Run with `bun test` from services/portfolio.
 *
 * Scope note: the RWA_Transfer handler and the captured consumer callback are
 * invoked directly. The stock processMessage path passes through
 * processEventExactlyOnce, which opens a MongoDB transaction (replica set), so
 * duplicate-delivery filtering and retry/parking accounting stay out of these
 * isolated tests.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { BlockchainEventsDaemon } from '../src/daemons/blockchainEvents.daemon';
import { PortfolioService } from '../src/services/portfolio.service';
import type { BlockchainEvent, EventRouting } from '@shared/blockchain-daemon/src/baseBlockchain.daemon';
import type { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import type { TokenBalanceRepository } from '../src/repositories/tokenBalance.repository';
import type { TransactionRepository } from '../src/repositories/transaction.repository';
import { createFakeRabbitMQClient, type FakeRabbitMQClient } from './fakes/rabbitmq.client.fake';
import {
  createFakeTokenBalanceRepository,
  type FakeTokenBalanceRepository,
} from './fakes/tokenBalance.repository.fake';
import { createFakeTransactionRepository, type FakeTransactionRepository } from './fakes/transaction.repository.fake';

const QUEUE_NAME = 'blockchain.events.portfolio';

const FROM = '0x1111111111111111111111111111111111111111';
const TO = '0x2222222222222222222222222222222222222222';
const TOKEN_ADDRESS = '0x3333333333333333333333333333333333333333';
const POOL_ADDRESS = '0x4444444444444444444444444444444444444444';

/**
 * Test-only subclass: getEventRouting() is protected, so the routing table is
 * exposed through a public method instead of reaching into the instance.
 */
class TestBlockchainEventsDaemon extends BlockchainEventsDaemon {
  public routing(): EventRouting {
    return this.getEventRouting();
  }
}

/** Synthetic RWA_Transfer event as published by the blockchain scanner. */
const TRANSFER_EVENT: BlockchainEvent = {
  chainId: 137,
  name: 'RWA_Transfer',
  blockNumber: 42,
  transactionHash: '0xe2e2e2e2',
  address: '0x9999999999999999999999999999999999999999',
  logIndex: 3,
  data: {
    emittedFrom: TOKEN_ADDRESS, // the RWA token contract that emitted the event
    from: FROM,
    to: TO,
    tokenId: '7',
    amount: '250',
    pool: POOL_ADDRESS,
  },
  timestamp: 1_700_000_000,
};

type TransferPayload = {
  from: string;
  to: string;
  tokenAddress: string;
  tokenId: string;
  chainId: string;
  transactionHash: string;
  blockNumber: number;
  amount: number;
  poolAddress: string;
};

function createPortfolioServiceSpy() {
  return {
    processTransfer: mock(async (_data: TransferPayload) => {}),
  };
}

function createMessage(payload: unknown) {
  return {
    content: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)),
    properties: { headers: {} },
  };
}

describe('BlockchainEventsDaemon (unit, fake rabbit client)', () => {
  let rabbit: FakeRabbitMQClient;
  let serviceSpy: ReturnType<typeof createPortfolioServiceSpy>;
  let daemon: TestBlockchainEventsDaemon;

  beforeEach(() => {
    rabbit = createFakeRabbitMQClient();
    serviceSpy = createPortfolioServiceSpy();
    daemon = new TestBlockchainEventsDaemon(
      rabbit as unknown as RabbitMQClient,
      serviceSpy as unknown as PortfolioService,
    );
  });

  test('routing: exposes exactly the RWA_Transfer handler', () => {
    const routing = daemon.routing();

    expect(Object.keys(routing)).toEqual(['RWA_Transfer']);
    expect(typeof routing['RWA_Transfer']).toBe('function');
  });

  test('RWA_Transfer: maps the scan payload onto processTransfer', async () => {
    await daemon.routing()['RWA_Transfer'](TRANSFER_EVENT);

    expect(serviceSpy.processTransfer).toHaveBeenCalledTimes(1);
    expect(serviceSpy.processTransfer).toHaveBeenCalledWith({
      from: FROM,
      to: TO,
      tokenAddress: TOKEN_ADDRESS, // emittedFrom, not the scanner-side `address`
      tokenId: '7',
      chainId: '137', // event.chainId is stringified for the balance key
      transactionHash: '0xe2e2e2e2',
      blockNumber: 42,
      amount: 250, // the '250' string from the event data becomes a number
      poolAddress: POOL_ADDRESS,
    });
  });

  test('RWA_Transfer: normalizes numeric fields before calling the service', async () => {
    const routing = daemon.routing();

    await routing['RWA_Transfer']({ ...TRANSFER_EVENT, data: { ...TRANSFER_EVENT.data, amount: '0.5' } });
    await routing['RWA_Transfer']({ ...TRANSFER_EVENT, data: { ...TRANSFER_EVENT.data, amount: 3 } });

    const payloads = serviceSpy.processTransfer.mock.calls.map((call) => call[0]);

    expect(payloads).toHaveLength(2);
    expect(payloads[0].amount).toBe(0.5);
    expect(typeof payloads[0].amount).toBe('number');
    expect(payloads[1].amount).toBe(3);
    expect(payloads.every((payload) => typeof payload.chainId === 'string')).toBe(true);
  });

  test('RWA_Transfer: drives the real service onto the fake repositories', async () => {
    const balances: FakeTokenBalanceRepository = createFakeTokenBalanceRepository();
    const transactions: FakeTransactionRepository = createFakeTransactionRepository();
    const service = new PortfolioService(
      balances as unknown as TokenBalanceRepository,
      transactions as unknown as TransactionRepository,
    );
    const wiredDaemon = new TestBlockchainEventsDaemon(rabbit as unknown as RabbitMQClient, service);

    await wiredDaemon.routing()['RWA_Transfer'](TRANSFER_EVENT);

    expect(transactions.store.size).toBe(1);
    const transaction = Array.from(transactions.store.values())[0];
    expect(transaction?.from).toBe(FROM);
    expect(transaction?.to).toBe(TO);
    expect(transaction?.tokenAddress).toBe(TOKEN_ADDRESS);
    expect(transaction?.poolAddress).toBe(POOL_ADDRESS);
    expect(transaction?.tokenId).toBe('7');
    expect(transaction?.chainId).toBe('137');
    expect(transaction?.transactionHash).toBe('0xe2e2e2e2');
    expect(transaction?.blockNumber).toBe(42);
    expect(transaction?.amount).toBe(250);

    const position = (owner: string) =>
      balances.store.get(
        balances.keyOf({
          owner,
          tokenAddress: TOKEN_ADDRESS,
          tokenId: '7',
          poolAddress: POOL_ADDRESS,
          chainId: '137',
        }),
      );

    expect(balances.store.size).toBe(2);
    expect(position(FROM)?.balance).toBe(-250);
    expect(position(TO)?.balance).toBe(250);
  });

  test('initialize: declares the queue, binds RWA_Transfer and starts consuming', async () => {
    await daemon.initialize();

    // The daemon owns the blockchain.events.portfolio queue...
    expect(rabbit.setupQueue).toHaveBeenCalledWith(QUEUE_NAME, expect.objectContaining({ durable: true }));
    // ...binds exactly the events it routes...
    expect(rabbit.bindQueue).toHaveBeenCalledWith(QUEUE_NAME, 'blockchain.events', 'RWA_Transfer');
    // ...and consumes with manual acks, one message in flight.
    expect(rabbit.consume).toHaveBeenCalledWith(QUEUE_NAME, expect.any(Function), { noAck: false, prefetch: 1 });
    expect(typeof rabbit.consumerFor(QUEUE_NAME)).toBe('function');
  });

  test('consumer: a malformed payload is parked and acknowledged, never routed', async () => {
    await daemon.initialize();
    const consumer = rabbit.consumerFor(QUEUE_NAME);
    expect(typeof consumer).toBe('function');

    const message = createMessage('not-json');
    await consumer!(message);

    // The raw payload is parked for manual inspection and the original message
    // is acknowledged (prefetch=1: never leave it unacknowledged).
    expect(rabbit.sendToQueue).toHaveBeenCalledWith(
      `${QUEUE_NAME}.parked`,
      expect.objectContaining({ reason: 'Invalid payload (not a JSON event)', content: 'not-json' }),
    );
    expect(rabbit.ack).toHaveBeenCalledWith(message);
    expect(serviceSpy.processTransfer).toHaveBeenCalledTimes(0);
  });

  test('consumer: an event without a handler is acknowledged without touching the service', async () => {
    await daemon.initialize();
    const consumer = rabbit.consumerFor(QUEUE_NAME)!;

    const message = createMessage({ ...TRANSFER_EVENT, name: 'RWA_Deployed' });
    await consumer(message);

    expect(rabbit.ack).toHaveBeenCalledWith(message);
    expect(rabbit.sendToQueue).toHaveBeenCalledTimes(0);
    expect(serviceSpy.processTransfer).toHaveBeenCalledTimes(0);
  });
});
