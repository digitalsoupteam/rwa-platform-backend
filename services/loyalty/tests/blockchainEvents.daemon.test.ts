/**
 * Component tests for the loyalty blockchain-events daemon.
 *
 * The daemon is subclassed only to expose its protected routing table; the
 * RabbitMQ client is replaced by an in-memory fake whose consume() captures
 * the callback (replayed with synthetic messages) and the LoyaltyService by a
 * stub with mock methods. No broker, no database and no publish happens.
 *
 * The exactly-once wrapper of the base class (shared/blockchain-daemon) opens
 * a MongoDB transaction per message, so the consumption path is exercised via
 * the routing table plus the ack/park branches that run before the
 * transaction; the five handlers themselves are asserted in isolation.
 * Run with `bun test` from services/loyalty.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { AppError } from '@shared/errors/app-errors';
import type { BlockchainEvent, EventRouting } from '@shared/blockchain-daemon/src/baseBlockchain.daemon';
import type { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import type { LoyaltyService } from '../src/services/loyalty.service';
import { BlockchainEventsDaemon } from '../src/daemons/blockchainEvents.daemon';
import { createFakeRabbitMQClient, type FakeRabbitMQClient } from './fakes/rabbitmq.client.fake';

const QUEUE_NAME = 'blockchain.events.loyalty';

const EVENT_ROUTING_CASES = [
  { event: 'Factory_CreateRWAFeeCollected', serviceMethod: 'processCreateRWAFeeCollected' },
  { event: 'Factory_CreatePoolFeeCollected', serviceMethod: 'processCreatePoolFeeCollected' },
  { event: 'Pool_RwaMinted', serviceMethod: 'processRwaMinted' },
  { event: 'Pool_RwaBurned', serviceMethod: 'processRwaBurned' },
  { event: 'ReferralTreasury_Withdrawn', serviceMethod: 'processReferralTreasuryWithdrawn' },
] as const;

function createFakeLoyaltyService() {
  return {
    processCreateRWAFeeCollected: mock(async (_event: unknown) => {}),
    processCreatePoolFeeCollected: mock(async (_event: unknown) => {}),
    processRwaMinted: mock(async (_event: unknown) => {}),
    processRwaBurned: mock(async (_event: unknown) => {}),
    processReferralTreasuryWithdrawn: mock(async (_event: unknown) => {}),
  };
}

type FakeLoyaltyService = ReturnType<typeof createFakeLoyaltyService>;

class TestableBlockchainEventsDaemon extends BlockchainEventsDaemon {
  /** Exposes the protected routing table so handlers can be invoked directly. */
  routing(): EventRouting {
    return this.getEventRouting();
  }
}

function buildEvent(name: string): BlockchainEvent {
  return {
    chainId: 97,
    name,
    blockNumber: 123456,
    transactionHash: '0x' + 'ab'.repeat(32),
    address: '0x' + '44'.repeat(20),
    logIndex: 7,
    data: {
      sender: '0x' + '11'.repeat(20),
      minter: '0x' + '11'.repeat(20),
      burner: '0x' + '11'.repeat(20),
      user: '0x' + '11'.repeat(20),
      token: '0x' + '22'.repeat(20),
      holdToken: '0x' + '22'.repeat(20),
      amount: '1000',
      feePaid: '1000',
      holdFeePaid: '600',
      bonusFeePaid: '400',
    },
    timestamp: 1730000000,
  };
}

describe('BlockchainEventsDaemon (component, fake RabbitMQ client and service stub)', () => {
  let rabbit: FakeRabbitMQClient;
  let service: FakeLoyaltyService;
  let daemon: TestableBlockchainEventsDaemon;

  beforeEach(() => {
    rabbit = createFakeRabbitMQClient();
    service = createFakeLoyaltyService();
    daemon = new TestableBlockchainEventsDaemon(
      rabbit as unknown as RabbitMQClient,
      service as unknown as LoyaltyService,
    );
  });

  function methods(): Record<string, ReturnType<typeof mock>> {
    return service as unknown as Record<string, ReturnType<typeof mock>>;
  }

  test('registers exactly the five loyalty events', () => {
    expect(Object.keys(daemon.routing()).sort()).toEqual(EVENT_ROUTING_CASES.map((c) => c.event).sort());
  });

  for (const { event, serviceMethod } of EVENT_ROUTING_CASES) {
    test(`routes ${event} to loyaltyService.${serviceMethod} with the full event`, async () => {
      const blockchainEvent = buildEvent(event);

      await daemon.routing()[event](blockchainEvent);

      expect(methods()[serviceMethod]).toHaveBeenCalledTimes(1);
      expect(methods()[serviceMethod]).toHaveBeenCalledWith(blockchainEvent);

      for (const other of EVENT_ROUTING_CASES) {
        if (other.serviceMethod !== serviceMethod) {
          expect(methods()[other.serviceMethod]).toHaveBeenCalledTimes(0);
        }
      }
    });
  }

  test('a handler settles only after the service call resolves', async () => {
    let resolveService: () => void = () => {};
    service.processRwaMinted.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveService = resolve;
        }),
    );

    const handlerPromise = daemon.routing()['Pool_RwaMinted'](buildEvent('Pool_RwaMinted'));
    let settled = false;
    void handlerPromise.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    resolveService();
    await handlerPromise;
    expect(settled).toBe(true);
  });

  test('propagates a service rejection to the caller', async () => {
    const failure = new AppError({ message: 'processing failed', statusCode: 503, code: 'SERVICE_UNAVAILABLE' });
    service.processReferralTreasuryWithdrawn.mockRejectedValueOnce(failure);

    await expect(
      daemon.routing()['ReferralTreasury_Withdrawn'](buildEvent('ReferralTreasury_Withdrawn')),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  describe('initialize and message consumption', () => {
    test('declares the loyalty queues and binds every routed event', async () => {
      await daemon.initialize();

      expect(rabbit.setupExchange.mock.calls.map((call) => call[0])).toEqual([
        'blockchain.events',
        `${QUEUE_NAME}.retry.exchange`,
      ]);

      expect(rabbit.setupQueue.mock.calls.map((call) => call[0])).toEqual([
        QUEUE_NAME,
        `${QUEUE_NAME}.retry`,
        `${QUEUE_NAME}.parked`,
      ]);

      expect(rabbit.setupQueue).toHaveBeenCalledWith(QUEUE_NAME, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': `${QUEUE_NAME}.retry.exchange`,
          'x-dead-letter-routing-key': `${QUEUE_NAME}.retry`,
        },
      });

      const eventBindings = rabbit.bindQueue.mock.calls
        .filter((call) => call[1] === 'blockchain.events')
        .map((call) => call[2]);
      expect(eventBindings).toHaveLength(EVENT_ROUTING_CASES.length);
      expect(new Set(eventBindings)).toEqual(new Set(EVENT_ROUTING_CASES.map((c) => c.event)));

      expect(rabbit.bindQueue).toHaveBeenCalledWith(
        `${QUEUE_NAME}.retry`,
        `${QUEUE_NAME}.retry.exchange`,
        `${QUEUE_NAME}.retry`,
      );

      expect(rabbit.consume).toHaveBeenCalledTimes(1);
      const [queue, handler, options] = rabbit.consume.mock.calls[0];
      expect(queue).toBe(QUEUE_NAME);
      expect(typeof handler).toBe('function');
      expect(options).toEqual({ noAck: false, prefetch: 1 });
      expect(typeof rabbit.consumerFor(QUEUE_NAME)).toBe('function');
    });

    test('replays a non-JSON message to the parked queue and acknowledges it', async () => {
      await daemon.initialize();
      const handler = rabbit.consumerFor(QUEUE_NAME)!;
      const message = rabbit.buildMessage('this is not json');

      await handler(message);

      expect(rabbit.sendToQueue).toHaveBeenCalledTimes(1);
      const [parkedQueue, payload] = rabbit.sendToQueue.mock.calls[0];
      expect(parkedQueue).toBe(`${QUEUE_NAME}.parked`);
      expect(payload).toMatchObject({
        content: 'this is not json',
        reason: expect.any(String),
        parkedAt: expect.any(Number),
      });
      expect(rabbit.ack).toHaveBeenCalledWith(message);
      expect(rabbit.nack).toHaveBeenCalledTimes(0);
    });

    test('acknowledges an event without a registered handler and never calls the service', async () => {
      await daemon.initialize();
      const handler = rabbit.consumerFor(QUEUE_NAME)!;
      const message = rabbit.buildMessage(buildEvent('Something_Unknown'));

      await handler(message);

      expect(rabbit.ack).toHaveBeenCalledWith(message);
      expect(rabbit.sendToQueue).toHaveBeenCalledTimes(0);
      for (const { serviceMethod } of EVENT_ROUTING_CASES) {
        expect(methods()[serviceMethod]).toHaveBeenCalledTimes(0);
      }
    });
  });
});
