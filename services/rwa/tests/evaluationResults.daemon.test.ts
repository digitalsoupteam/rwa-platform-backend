/**
 * Unit tests for EvaluationResultsDaemon.
 *
 * Scope: the daemon layer only. Both services are replaced with in-memory
 * fakes (tests/fakes/*.fake.ts), and the daemon registers its consumer on the
 * fake RabbitMQ client — tests invoke the captured handler with synthetic
 * amqplib messages and assert the reliability decisions (ack / retry through
 * the retry queue / park into evaluation.results.parked).
 * No broker, no database. Run with `bun test` from services/rwa.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';
import { AppError } from '@shared/errors/app-errors';
import { EvaluationResultsDaemon } from '../src/daemons/evaluationResults.daemon';
import { EVALUATION_RESULTS_QUEUE } from '../src/clients/evaluationResults.client';
import type { BusinessService } from '../src/services/business.service';
import type { PoolService } from '../src/services/pool.service';
import { createFakeBusinessService, type FakeBusinessService } from './fakes/business.service.fake';
import { createFakePoolService, type FakePoolService } from './fakes/pool.service.fake';
import { createFakeRabbitMQClient, type FakeRabbitMQClient } from './fakes/rabbitmq.client.fake';

function syntheticMessage(payload: unknown): ConsumeMessage {
  return {
    content: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)),
    fields: { routingKey: 'evaluation.results' },
    properties: { headers: {} },
  } as unknown as ConsumeMessage;
}

describe('EvaluationResultsDaemon (unit, fake broker and services)', () => {
  let rabbit: FakeRabbitMQClient;
  let poolService: FakePoolService;
  let businessService: FakeBusinessService;
  let daemon: EvaluationResultsDaemon;
  let handle: (message: ConsumeMessage | null) => Promise<void>;

  beforeEach(async () => {
    rabbit = createFakeRabbitMQClient();
    poolService = createFakePoolService();
    businessService = createFakeBusinessService();
    daemon = new EvaluationResultsDaemon(
      rabbit as unknown as never,
      poolService as unknown as PoolService,
      businessService as unknown as BusinessService,
    );

    await daemon.initialize();
    handle = rabbit.consumedHandlers.get(EVALUATION_RESULTS_QUEUE)!;
  });

  test('initialize: registers the daemon handler as the evaluation.results consumer', () => {
    expect(rabbit.consume).toHaveBeenCalledTimes(1);
    expect(rabbit.consume.mock.calls[0][0]).toBe(EVALUATION_RESULTS_QUEUE);
    expect(typeof handle).toBe('function');
  });

  test('completed pool result: sets the risk score and acks', async () => {
    const message = syntheticMessage({
      evaluationId: 'evaluation-1',
      entityType: 'pool',
      entityId: 'pool-1',
      status: 'completed',
      riskScore: 55,
    });

    await handle(message);

    expect(poolService.setRiskScore).toHaveBeenCalledWith({ id: 'pool-1', riskScore: 55 });
    expect(businessService.setRiskScore).toHaveBeenCalledTimes(0);
    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
  });

  test('completed business result: sets the risk score and acks', async () => {
    const message = syntheticMessage({
      evaluationId: 'evaluation-2',
      entityType: 'business',
      entityId: 'business-1',
      status: 'completed',
      riskScore: 77,
    });

    await handle(message);

    expect(businessService.setRiskScore).toHaveBeenCalledWith({ id: 'business-1', riskScore: 77 });
    expect(poolService.setRiskScore).toHaveBeenCalledTimes(0);
    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
  });

  test('failed pool result: resets the evaluation and acks', async () => {
    const message = syntheticMessage({
      evaluationId: 'evaluation-1',
      entityType: 'pool',
      entityId: 'pool-1',
      status: 'failed',
    });

    await handle(message);

    expect(poolService.resetEvaluation).toHaveBeenCalledWith({ id: 'pool-1' });
    expect(poolService.setRiskScore).toHaveBeenCalledTimes(0);
    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
  });

  test('failed business result: resets the evaluation and acks', async () => {
    const message = syntheticMessage({
      evaluationId: 'evaluation-2',
      entityType: 'business',
      entityId: 'business-1',
      status: 'failed',
    });

    await handle(message);

    expect(businessService.resetEvaluation).toHaveBeenCalledWith({ id: 'business-1' });
    expect(businessService.setRiskScore).toHaveBeenCalledTimes(0);
    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
  });

  test('a null message is ignored', async () => {
    await handle(null);

    expect(rabbit.acked).toHaveLength(0);
    expect(rabbit.nacked).toHaveLength(0);
    expect(poolService.setRiskScore).toHaveBeenCalledTimes(0);
    expect(poolService.resetEvaluation).toHaveBeenCalledTimes(0);
    expect(businessService.setRiskScore).toHaveBeenCalledTimes(0);
    expect(businessService.resetEvaluation).toHaveBeenCalledTimes(0);
  });

  test('an unparseable payload is parked', async () => {
    const message = syntheticMessage('{ not json');

    await handle(message);

    expect(rabbit.nacked).toHaveLength(0);
    expect(rabbit.acked).toEqual([message]); // parked = republished into the park queue, then acked
    expect(rabbit.sent).toHaveLength(1);
    expect(rabbit.sent[0].queue).toBe('evaluation.results.parked');
    expect(poolService.resetEvaluation).toHaveBeenCalledTimes(0);
    expect(businessService.resetEvaluation).toHaveBeenCalledTimes(0);
  });

  test('a result missing required fields is parked', async () => {
    // entityId is required but missing.
    const message = syntheticMessage({ evaluationId: 'evaluation-1', entityType: 'pool', status: 'completed' });

    await handle(message);

    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
    expect(rabbit.sent[0].queue).toBe('evaluation.results.parked');
    expect(poolService.setRiskScore).toHaveBeenCalledTimes(0);
  });

  test('an unknown entityType is parked and no service is called', async () => {
    for (const status of ['completed', 'failed']) {
      const message = syntheticMessage({ evaluationId: 'evaluation-1', entityType: 'unknown', entityId: 'x-1', status });

      await handle(message);

      expect(rabbit.acked).toContain(message);
      expect(rabbit.nacked).toHaveLength(0);
    }

    expect(rabbit.sent).toHaveLength(2);
    expect(rabbit.sent[0].queue).toBe('evaluation.results.parked');
    expect(rabbit.sent[1].queue).toBe('evaluation.results.parked');
    expect(poolService.setRiskScore).toHaveBeenCalledTimes(0);
    expect(poolService.resetEvaluation).toHaveBeenCalledTimes(0);
    expect(businessService.setRiskScore).toHaveBeenCalledTimes(0);
    expect(businessService.resetEvaluation).toHaveBeenCalledTimes(0);
  });

  test('an entity rejection (NOT_FOUND) is parked for inspection', async () => {
    const message = syntheticMessage({
      evaluationId: 'evaluation-2',
      entityType: 'business',
      entityId: 'business-1',
      status: 'completed',
      riskScore: 77,
    });
    businessService.setRiskScore.mockImplementationOnce(async () => {
      throw new AppError({ message: 'Business business-1 not found', statusCode: 404, code: 'NOT_FOUND' });
    });

    await handle(message);

    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
    expect(rabbit.sent[0].queue).toBe('evaluation.results.parked');
    expect(rabbit.sent[0].content.reason).toMatch(/not found/i);
  });

  test('a transient database failure earns a retry through the retry queue', async () => {
    const message = syntheticMessage({
      evaluationId: 'evaluation-2',
      entityType: 'business',
      entityId: 'business-1',
      status: 'completed',
      riskScore: 77,
    });
    businessService.setRiskScore.mockImplementationOnce(async () => {
      throw new Error('buffering timed out');
    });

    await handle(message);

    // Dead-lettered into `evaluation.results.retry` instead of being dropped.
    expect(rabbit.nacked).toHaveLength(1);
    expect(rabbit.nacked[0].message).toBe(message);
    expect(rabbit.nacked[0].requeue).toBe(false);
    expect(rabbit.acked).toHaveLength(0);
  });
});
