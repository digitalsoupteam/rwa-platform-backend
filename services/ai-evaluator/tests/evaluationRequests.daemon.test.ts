/**
 * Unit tests for EvaluationRequestsDaemon.
 *
 * Scope: the daemon layer only. The evaluation requests client is replaced with a
 * fake that captures the handler registered through consumeRequests(), and the
 * risk evaluation service is a fake too, so these tests need no broker, no
 * database and no network. Synthetic amqplib messages are built with
 * createConsumeMessage().
 *
 * The second block drives the real EvaluationRequestsClient and
 * EvaluationResultsClient over a fake RabbitMQClient, to pin the queue names and
 * ack/nack semantics the daemon relies on.
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
import {
  createFakeEvaluationRequestsClient,
  type FakeEvaluationRequestsClient,
} from './fakes/evaluationRequests.client.fake';
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

describe('EvaluationRequestsDaemon (unit, fake requests client and service)', () => {
  let requestsClient: FakeEvaluationRequestsClient;
  let service: FakeRiskEvaluationService;
  let daemon: EvaluationRequestsDaemon;

  beforeEach(() => {
    requestsClient = createFakeEvaluationRequestsClient();
    service = createFakeRiskEvaluationService();
    daemon = new EvaluationRequestsDaemon(
      requestsClient as unknown as EvaluationRequestsClient,
      service as unknown as RiskEvaluationService,
    );
  });

  /** Runs initialize() and returns the handler the daemon registered. */
  async function registerConsumer() {
    await daemon.initialize();

    const handler = requestsClient.getHandler();
    if (!handler) throw new Error('initialize() did not register a consumer');

    return handler;
  }

  test('initialize: registers exactly one consumer through the requests client', async () => {
    const handler = await registerConsumer();

    expect(requestsClient.consumeRequests).toHaveBeenCalledTimes(1);
    expect(typeof handler).toBe('function');
    expect(requestsClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(requestsClient.nackMessage).toHaveBeenCalledTimes(0);
  });

  test('evaluatePool: forwards the message args and acks the message', async () => {
    const handler = await registerConsumer();
    const message = createConsumeMessage(POOL_MESSAGE);

    await handler(message);

    expect(service.evaluatePool).toHaveBeenCalledTimes(1);
    expect(service.evaluatePool).toHaveBeenCalledWith({
      poolId: 'pool-1',
      ownerId: 'owner-1',
      ownerType: 'business',
    });
    expect(service.evaluateBusiness).toHaveBeenCalledTimes(0);
    expect(requestsClient.ackMessage).toHaveBeenCalledWith(message);
    expect(requestsClient.nackMessage).toHaveBeenCalledTimes(0);
  });

  test('evaluateBusiness: forwards the message args and acks the message', async () => {
    const handler = await registerConsumer();
    const message = createConsumeMessage(BUSINESS_MESSAGE);

    await handler(message);

    expect(service.evaluateBusiness).toHaveBeenCalledTimes(1);
    expect(service.evaluateBusiness).toHaveBeenCalledWith({
      businessId: 'business-1',
      ownerId: 'owner-1',
      ownerType: 'business',
    });
    expect(service.evaluatePool).toHaveBeenCalledTimes(0);
    expect(requestsClient.ackMessage).toHaveBeenCalledWith(message);
    expect(requestsClient.nackMessage).toHaveBeenCalledTimes(0);
  });

  test('an unknown method is nacked without requeue and never reaches the service', async () => {
    const handler = await registerConsumer();
    const message = createConsumeMessage({ method: 'evaluateDao', args: { id: 'dao-1' } });

    await handler(message);

    expect(service.evaluatePool).toHaveBeenCalledTimes(0);
    expect(service.evaluateBusiness).toHaveBeenCalledTimes(0);
    expect(requestsClient.ackMessage).toHaveBeenCalledTimes(0);
    // requeue=false: an unknown method will never succeed on a redelivery.
    expect(requestsClient.nackMessage).toHaveBeenCalledWith(message, false);
  });

  test('a failing evaluation is nacked without requeue and never acked', async () => {
    const handler = await registerConsumer();
    service.evaluatePool.mockRejectedValueOnce(
      new AppError({ message: 'rwa service unavailable', statusCode: 502, code: 'UPSTREAM_ERROR' }),
    );
    const message = createConsumeMessage(POOL_MESSAGE);

    await handler(message);

    expect(requestsClient.nackMessage).toHaveBeenCalledWith(message, false);
    expect(requestsClient.ackMessage).toHaveBeenCalledTimes(0);
  });

  test('a malformed payload is nacked without requeue', async () => {
    const handler = await registerConsumer();
    const message = createConsumeMessage('{"method": "evaluatePool"');

    await handler(message);

    expect(requestsClient.nackMessage).toHaveBeenCalledWith(message, false);
    expect(requestsClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(service.evaluatePool).toHaveBeenCalledTimes(0);
    expect(service.evaluateBusiness).toHaveBeenCalledTimes(0);
  });

  test('a null message (consumer cancelled delivery) is ignored', async () => {
    const handler = await registerConsumer();

    await handler(null);

    expect(requestsClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(requestsClient.nackMessage).toHaveBeenCalledTimes(0);
    expect(service.evaluatePool).toHaveBeenCalledTimes(0);
    expect(service.evaluateBusiness).toHaveBeenCalledTimes(0);
  });
});

describe('evaluation clients (real, over a fake RabbitMQClient)', () => {
  test('EvaluationRequestsClient: initializes the durable queue and consumes with noAck false', async () => {
    const rabbit = createFakeRabbitMQClient();
    const client = new EvaluationRequestsClient(rabbit as unknown as RabbitMQClient);
    const handler = mock(async (_message: ConsumeMessage | null): Promise<void> => {});

    await client.initialize();
    await client.consumeRequests(handler);

    expect(rabbit.setupQueue).toHaveBeenCalledWith('evaluation.requests', { durable: true });
    expect(rabbit.consume).toHaveBeenCalledTimes(1);

    const [queue, consumerHandler, options] = rabbit.consume.mock.calls[0];
    expect(queue).toBe('evaluation.requests');
    expect(consumerHandler).toBe(handler);
    expect(options).toEqual({ noAck: false });
  });

  test('EvaluationRequestsClient: ackMessage and nackMessage delegate to the rabbit client', async () => {
    const rabbit = createFakeRabbitMQClient();
    const client = new EvaluationRequestsClient(rabbit as unknown as RabbitMQClient);
    const message = createConsumeMessage(POOL_MESSAGE);

    await client.ackMessage(message);
    await client.nackMessage(message);
    await client.nackMessage(message, false);

    expect(rabbit.ack).toHaveBeenCalledTimes(1);
    expect(rabbit.ack).toHaveBeenCalledWith(message);
    // nackMessage defaults to requeue=true and forwards the flag explicitly.
    expect(rabbit.nack.mock.calls).toEqual([
      [message, true],
      [message, false],
    ]);
  });

  test('EvaluationResultsClient: initializes the durable queue and publishes to it', async () => {
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

    expect(rabbit.setupQueue).toHaveBeenCalledWith('evaluation.results', { durable: true });
    expect(rabbit.sendToQueue).toHaveBeenCalledWith('evaluation.results', result);
  });

  test('the consumer registered by the daemon is wired to the evaluation.requests queue', async () => {
    const rabbit = createFakeRabbitMQClient();
    const requestsClient = new EvaluationRequestsClient(rabbit as unknown as RabbitMQClient);
    const service = createFakeRiskEvaluationService();
    const daemon = new EvaluationRequestsDaemon(
      requestsClient as unknown as EvaluationRequestsClient,
      service as unknown as RiskEvaluationService,
    );

    await daemon.initialize();

    const consumer = rabbit.getConsumer();
    expect(consumer).not.toBeNull();
    expect(consumer!.queue).toBe('evaluation.requests');
    expect(consumer!.options).toEqual({ noAck: false });

    const message = createConsumeMessage(BUSINESS_MESSAGE);
    await consumer!.handler(message);

    expect(service.evaluateBusiness).toHaveBeenCalledWith({
      businessId: 'business-1',
      ownerId: 'owner-1',
      ownerType: 'business',
    });
    expect(rabbit.ack).toHaveBeenCalledWith(message);
  });
});
