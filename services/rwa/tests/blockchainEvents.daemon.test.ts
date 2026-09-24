/**
 * Unit tests for BlockchainEventsDaemon.
 *
 * Scope: the daemon layer only. RabbitMQ and both services are replaced with
 * in-memory fakes (tests/fakes/*.fake.ts), so these tests need no broker and
 * no database. getEventRouting() is protected, so the daemon is subclassed to
 * expose the routing table, and handlers are invoked with a synthetic
 * BlockchainEvent. Run with `bun test` from services/rwa.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { AppError } from '@shared/errors/app-errors';
import { BlockchainEventsDaemon } from '../src/daemons/blockchainEvents.daemon';
import type { BusinessService } from '../src/services/business.service';
import type { PoolService } from '../src/services/pool.service';
import type { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import type { BlockchainEvent, EventRouting } from '@shared/blockchain-daemon/src/baseBlockchain.daemon';
import { createFakeBusinessService, type FakeBusinessService } from './fakes/business.service.fake';
import { createFakePoolService, type FakePoolService } from './fakes/pool.service.fake';
import { createFakeRabbitMQClient, type FakeRabbitMQClient } from './fakes/rabbitmq.client.fake';

const QUEUE_NAME = 'blockchain.events.rwa';
const EXCHANGE_NAME = 'blockchain.events';

/** Exposes the protected routing table for direct handler invocation. */
class TestBlockchainEventsDaemon extends BlockchainEventsDaemon {
  public routing(): EventRouting {
    return this.getEventRouting();
  }
}

const BUSINESS_EVENT = 'RWA_Deployed';

// Every pool event the daemon routes, and the PoolService method it must call.
const POOL_EVENT_ROUTING: Array<[string, keyof FakePoolService]> = [
  ['Pool_Deployed', 'syncPoolAfterDeployment'],
  ['Pool_BonusWithdrawn', 'syncPoolBonusWithdrawn'],
  ['Pool_AwaitingRwaAmountUpdated', 'syncPoolAwaitingRwaAmount'],
  ['Pool_FundsFullyReturned', 'syncPoolFundsFullyReturned'],
  ['Pool_IncomingReturnSummary', 'syncPoolIncomingReturnSummary'],
  ['Pool_IncomingTrancheUpdate', 'syncPoolIncomingTrancheUpdate'],
  ['Pool_OutgoingClaimSummary', 'syncPoolOutgoingClaimSummary'],
  ['Pool_OutgoingTrancheClaimed', 'syncPoolOutgoingTrancheClaimed'],
  ['Pool_PausedStateChanged', 'syncPoolPausedState'],
  ['Pool_ReservesUpdated', 'syncPoolReserves'],
  ['Pool_TargetReached', 'syncPoolTargetReached'],
];

function blockchainEvent(name: string, data: Record<string, unknown>): BlockchainEvent {
  return {
    chainId: 97,
    name,
    blockNumber: 123,
    transactionHash: `0x${'ab'.repeat(32)}`,
    address: '0x00000000000000000000000000000000000000aa',
    logIndex: 0,
    data,
    timestamp: 1717171717,
  };
}

describe('BlockchainEventsDaemon (unit, fake clients and services)', () => {
  let rabbitMQ: FakeRabbitMQClient;
  let businessService: FakeBusinessService;
  let poolService: FakePoolService;
  let daemon: TestBlockchainEventsDaemon;

  beforeEach(() => {
    rabbitMQ = createFakeRabbitMQClient();
    businessService = createFakeBusinessService();
    poolService = createFakePoolService();
    daemon = new TestBlockchainEventsDaemon(
      rabbitMQ as unknown as RabbitMQClient,
      businessService as unknown as BusinessService,
      poolService as unknown as PoolService,
    );
  });

  test('getEventRouting: exposes exactly the expected event handlers', () => {
    const routing = daemon.routing();

    const expectedEvents = [BUSINESS_EVENT, ...POOL_EVENT_ROUTING.map(([eventName]) => eventName)];
    expect(Object.keys(routing).sort()).toEqual(expectedEvents.sort());
  });

  test('getEventRouting: has no handler for unknown events', () => {
    expect(daemon.routing()['Pool_Unknown']).toBeUndefined();
  });

  test('RWA_Deployed: routes to businessService.syncAfterDeployment with event.data', async () => {
    const event = blockchainEvent(BUSINESS_EVENT, { entityId: 'business-1', emittedFrom: '0xtoken', owner: '0xowner' });

    await daemon.routing()[BUSINESS_EVENT](event);

    expect(businessService.syncAfterDeployment).toHaveBeenCalledTimes(1);
    expect(businessService.syncAfterDeployment).toHaveBeenCalledWith(event.data);
    expect(businessService.syncAfterDeployment.mock.calls[0][0]).toBe(event.data); // same reference, no re-mapping
    expect(poolService.syncPoolAfterDeployment).toHaveBeenCalledTimes(0);
  });

  for (const [eventName, method] of POOL_EVENT_ROUTING) {
    test(`${eventName}: routes to poolService.${method} with event.data`, async () => {
      const event = blockchainEvent(eventName, { entityId: 'pool-1', emittedFrom: '0xpool' });

      await daemon.routing()[eventName](event);

      expect(poolService[method]).toHaveBeenCalledTimes(1);
      expect(poolService[method]).toHaveBeenCalledWith(event.data);
      expect(poolService[method].mock.calls[0][0]).toBe(event.data); // same reference, no re-mapping
    });
  }

  test('routing handlers propagate service errors', async () => {
    const serviceError = new AppError({ message: 'Database unavailable', statusCode: 503, code: 'SERVICE_UNAVAILABLE' });
    poolService.syncPoolReserves.mockImplementationOnce(async () => {
      throw serviceError;
    });
    const event = blockchainEvent('Pool_ReservesUpdated', { emittedFrom: '0xpool' });

    await expect(daemon.routing()['Pool_ReservesUpdated'](event)).rejects.toBe(serviceError);
  });

  test('initialize: binds the queue to every routed event and starts consuming', async () => {
    await daemon.initialize();

    expect(rabbitMQ.setupExchange).toHaveBeenCalledWith(EXCHANGE_NAME, 'direct', { durable: true });
    expect(rabbitMQ.setupQueue).toHaveBeenCalledWith(QUEUE_NAME, expect.any(Object));

    const routedEvents = Object.keys(daemon.routing());
    for (const eventName of routedEvents) {
      expect(rabbitMQ.bindQueue).toHaveBeenCalledWith(QUEUE_NAME, EXCHANGE_NAME, eventName);
    }

    expect(rabbitMQ.consume).toHaveBeenCalledTimes(1);
    expect(rabbitMQ.consume.mock.calls[0][0]).toBe(QUEUE_NAME);
    expect(typeof rabbitMQ.consume.mock.calls[0][1]).toBe('function');
    expect(rabbitMQ.consumedHandlers.has(QUEUE_NAME)).toBe(true);
  });
});
