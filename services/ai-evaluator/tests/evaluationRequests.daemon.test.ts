/**
 * Unit tests for EvaluationRequestsDaemon.
 *
 * Scope: the daemon layer only. The risk evaluation service is a fake, and the
 * daemon registers its consumer on the fake RabbitMQ client — tests invoke the
 * captured handler with synthetic amqplib messages (createConsumeMessage()) and
 * assert the reliability decisions (ack / retry through the retry queue / park
 * into evaluation.requests.parked). No broker, no database, no network.
 *
 * The second block drives the real EvaluationRequestsClient and
 * EvaluationResultsClient over a fake RabbitMQClient, to pin the queue names
 * and the retry topology both sides rely on.
 * Run with `bun test` from services/ai-evaluator.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';
import { AppError } from '@shared/errors/app-errors';
import type { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { EvaluationRequestsClient } from '../src/clients/evaluationRequests.client';
import { EvaluationResultsClient } from '../src/clients/evaluationResults.client';
import { EvaluationRequestsDaemon } from '../src/daemons/evaluationRequests.daemon';
import type { RiskEvaluationService } from '../src/services/riskEvaluation.service';
import { createConsumeMessage, createFakeRabbitMQClient } from './fakes/rabbitmq.client.fake';

function createFakeRiskEvaluationService() {
  return {
    evaluatePool: mock(async (_params: { poolId: string; ownerId: string; ownerType: string }): Promise<void> => {}),
    evaluateBusiness: mock(
      async (_params: { businessId: string; ownerId: string; ownerType: string }): Promise<void> => {},
    ),
  };
}

type FakeRiskEvaluationService = ReturnType<typeof createFakeRiskEvaluationService>;

const POOL_MESSAGE = {
  method: 'evaluatePool',
  args: { poolId: 'pool-1', ownerId: 'owner-1', ownerType: 'business' },
};

const BUSINESS_MESSAGE = {
  method: 'evaluateBusiness',
  args: { businessId: 'business-1', ownerId: 'owner-1', ownerType: 'business' },
};

describe('EvaluationRequestsDaemon (unit, fake broker and service)', () => {
  let rabbit: ReturnType<typeof createFakeRabbitMQClient>;
  let service: FakeRiskEvaluationService;
  let daemon: EvaluationRequestsDaemon;
  let handler: (message: ConsumeMessage | null) => Promise<void>;

  beforeEach(async () => {
    rabbit = createFakeRabbitMQClient();
    service = createFakeRiskEvaluationService();
    daemon = new EvaluationRequestsDaemon(
      rabbit as unknown as RabbitMQClient,
      service as unknown as RiskEvaluationService,
    );

    await daemon.initialize();
    const consumer = rabbit.getConsumer();
    if (!consumer) throw new Error('initialize() did not register a consumer');
    handler = consumer.handler;
  });

  test('initialize: registers exactly one consumer on the evaluation.requests queue', () => {
    const consumer = rabbit.getConsumer()!;

    expect(rabbit.consume).toHaveBeenCalledTimes(1);
    expect(consumer.queue).toBe('evaluation.requests');
    expect(consumer.options).toEqual({ noAck: false });
    expect(rabbit.acked).toHaveLength(0);
    expect(rabbit.nacked).toHaveLength(0);
  });

  test('evaluatePool: forwards the message args and acks the message', async () => {
    const message = createConsumeMessage(POOL_MESSAGE);

    await handler(message);

    expect(service.evaluatePool).toHaveBeenCalledTimes(1);
    expect(service.evaluatePool).toHaveBeenCalledWith({
      poolId: 'pool-1',
      ownerId: 'owner-1',
      ownerType: 'business',
    });
    expect(service.evaluateBusiness).toHaveBeenCalledTimes(0);
    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
  });

  test('evaluateBusiness: forwards the message args and acks the message', async () => {
    const message = createConsumeMessage(BUSINESS_MESSAGE);

    await handler(message);

    expect(service.evaluateBusiness).toHaveBeenCalledTimes(1);
    expect(service.evaluateBusiness).toHaveBeenCalledWith({
      businessId: 'business-1',
      ownerId: 'owner-1',
      ownerType: 'business',
    });
    expect(service.evaluatePool).toHaveBeenCalledTimes(0);
    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
  });

  test('an unknown method is parked and never reaches the service', async () => {
    const message = createConsumeMessage({ method: 'evaluateDao', args: { id: 'dao-1' } });

    await handler(message);

    expect(service.evaluatePool).toHaveBeenCalledTimes(0);
    expect(service.evaluateBusiness).toHaveBeenCalledTimes(0);
    expect(rabbit.nacked).toHaveLength(0);
    expect(rabbit.acked).toEqual([message]); // parked = republished into the park queue, then acked
    expect(rabbit.sent).toHaveLength(1);
    expect(rabbit.sent[0].queue).toBe('evaluation.requests.parked');
  });

  test('a transient upstream failure is retried through the retry queue', async () => {
    service.evaluatePool.mockRejectedValueOnce(
      new AppError({ message: 'rwa service unavailable', statusCode: 502, code: 'UPSTREAM_ERROR' }),
    );
    const message = createConsumeMessage(POOL_MESSAGE);

    await handler(message);

    // Dead-lettered into `evaluation.requests.retry` instead of being dropped.
    expect(rabbit.nacked).toHaveLength(1);
    expect(rabbit.nacked[0].message).toBe(message);
    expect(rabbit.nacked[0].requeue).toBe(false);
    expect(rabbit.acked).toHaveLength(0);
  });

  test('a malformed payload is parked', async () => {
    const message = createConsumeMessage('{"method": "evaluatePool"');

    await handler(message);

    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
    expect(rabbit.sent[0].queue).toBe('evaluation.requests.parked');
    expect(service.evaluatePool).toHaveBeenCalledTimes(0);
    expect(service.evaluateBusiness).toHaveBeenCalledTimes(0);
  });

  test('a null message (consumer cancelled delivery) is ignored', async () => {
    await handler(null);

    expect(rabbit.acked).toHaveLength(0);
    expect(rabbit.nacked).toHaveLength(0);
    expect(service.evaluatePool).toHaveBeenCalledTimes(0);
    expect(service.evaluateBusiness).toHaveBeenCalledTimes(0);
  });
});

describe('evaluation clients (real, over a fake RabbitMQClient)', () => {
  test('EvaluationRequestsClient: initializes the queue with the retry topology', async () => {
    const rabbit = createFakeRabbitMQClient();
    const client = new EvaluationRequestsClient(rabbit as unknown as RabbitMQClient);

    await client.initialize();

    expect(rabbit.setupExchange).toHaveBeenCalledWith('evaluation.requests.retry.exchange', 'direct', {
      durable: true,
    });
    expect(rabbit.setupQueue).toHaveBeenCalledWith('evaluation.requests', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'evaluation.requests.retry.exchange',
        'x-dead-letter-routing-key': 'evaluation.requests.retry',
      },
    });
    expect(rabbit.setupQueue).toHaveBeenCalledWith('evaluation.requests.retry', {
      durable: true,
      arguments: {
        'x-message-ttl': 10_000,
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'evaluation.requests',
      },
    });
    expect(rabbit.setupQueue).toHaveBeenCalledWith('evaluation.requests.parked', { durable: true });
  });

  test('EvaluationResultsClient: initializes the queue with the retry topology and publishes to it', async () => {
    const rabbit = createFakeRabbitMQClient();
    const client = new EvaluationResultsClient(rabbit as unknown as RabbitMQClient);
    const result = {
      evaluationId: 'evaluation-1',
      entityType: 'pool',
      entityId: 'pool-1',
      status: 'completed',
      riskScore: 42,
    } as const;

    await client.initialize();
    await client.publishEvaluationResult(result);

    expect(rabbit.setupQueue).toHaveBeenCalledWith('evaluation.results', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'evaluation.results.retry.exchange',
        'x-dead-letter-routing-key': 'evaluation.results.retry',
      },
    });
    expect(rabbit.sendToQueue).toHaveBeenCalledWith('evaluation.results', result);
  });
});
