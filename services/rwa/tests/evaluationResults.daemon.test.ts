/**
 * Unit tests for EvaluationResultsDaemon.
 *
 * Scope: the daemon layer only. The results client and both services are
 * replaced with in-memory fakes (tests/fakes/*.fake.ts): the fake client
 * captures the handler registered through consumeResults(), and the tests
 * invoke it with synthetic amqplib messages. No broker, no database.
 * Run with `bun test` from services/rwa.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';
import { AppError } from '@shared/errors/app-errors';
import { EvaluationResultsDaemon } from '../src/daemons/evaluationResults.daemon';
import type { EvaluationResultsClient } from '../src/clients/evaluationResults.client';
import type { BusinessService } from '../src/services/business.service';
import type { PoolService } from '../src/services/pool.service';
import {
  createFakeEvaluationResultsClient,
  type FakeEvaluationResultsClient,
} from './fakes/evaluation-results.client.fake';
import { createFakeBusinessService, type FakeBusinessService } from './fakes/business.service.fake';
import { createFakePoolService, type FakePoolService } from './fakes/pool.service.fake';

function syntheticMessage(payload: unknown): ConsumeMessage {
  return {
    content: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)),
    fields: { routingKey: 'evaluation.results' },
    properties: { headers: {} },
  } as unknown as ConsumeMessage;
}

describe('EvaluationResultsDaemon (unit, fake client and services)', () => {
  let results: FakeEvaluationResultsClient;
  let poolService: FakePoolService;
  let businessService: FakeBusinessService;
  let daemon: EvaluationResultsDaemon;

  beforeEach(() => {
    results = createFakeEvaluationResultsClient();
    poolService = createFakePoolService();
    businessService = createFakeBusinessService();
    daemon = new EvaluationResultsDaemon(
      results as unknown as EvaluationResultsClient,
      poolService as unknown as PoolService,
      businessService as unknown as BusinessService,
    );
  });

  // initialize() registers the daemon handler on the fake client; the tests
  // then feed synthetic messages straight into that captured handler.
  async function handle(message: ConsumeMessage | null) {
    await daemon.initialize();
    return results.getConsumeHandler()(message);
  }

  test('initialize: registers the daemon handler as the evaluation.results consumer', async () => {
    await daemon.initialize();

    expect(results.consumeResults).toHaveBeenCalledTimes(1);
    expect(typeof results.consumeResults.mock.calls[0][0]).toBe('function');
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
    expect(results.ackMessage).toHaveBeenCalledWith(message);
    expect(results.nackMessage).toHaveBeenCalledTimes(0);
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
    expect(results.ackMessage).toHaveBeenCalledWith(message);
    expect(results.nackMessage).toHaveBeenCalledTimes(0);
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
    expect(results.ackMessage).toHaveBeenCalledWith(message);
    expect(results.nackMessage).toHaveBeenCalledTimes(0);
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
    expect(results.ackMessage).toHaveBeenCalledWith(message);
    expect(results.nackMessage).toHaveBeenCalledTimes(0);
  });

  test('a null message is ignored', async () => {
    await handle(null);

    expect(results.ackMessage).toHaveBeenCalledTimes(0);
    expect(results.nackMessage).toHaveBeenCalledTimes(0);
    expect(poolService.setRiskScore).toHaveBeenCalledTimes(0);
    expect(poolService.resetEvaluation).toHaveBeenCalledTimes(0);
    expect(businessService.setRiskScore).toHaveBeenCalledTimes(0);
    expect(businessService.resetEvaluation).toHaveBeenCalledTimes(0);
  });

  test('an unparseable payload is nacked without requeue', async () => {
    const message = syntheticMessage('{ not json');

    await handle(message);

    expect(results.nackMessage).toHaveBeenCalledWith(message, false);
    expect(results.ackMessage).toHaveBeenCalledTimes(0);
    expect(poolService.resetEvaluation).toHaveBeenCalledTimes(0);
    expect(businessService.resetEvaluation).toHaveBeenCalledTimes(0);
  });

  test('a result missing required fields is nacked', async () => {
    // entityId is required but missing.
    const message = syntheticMessage({ evaluationId: 'evaluation-1', entityType: 'pool', status: 'completed' });

    await handle(message);

    expect(results.nackMessage).toHaveBeenCalledWith(message, false);
    expect(results.ackMessage).toHaveBeenCalledTimes(0);
    expect(poolService.setRiskScore).toHaveBeenCalledTimes(0);
  });

  test('an unknown entityType is nacked and no service is called', async () => {
    for (const status of ['completed', 'failed']) {
      const message = syntheticMessage({ evaluationId: 'evaluation-1', entityType: 'unknown', entityId: 'x-1', status });

      await handle(message);

      expect(results.nackMessage).toHaveBeenCalledWith(message, false);
      expect(results.ackMessage).toHaveBeenCalledTimes(0);
    }

    expect(poolService.setRiskScore).toHaveBeenCalledTimes(0);
    expect(poolService.resetEvaluation).toHaveBeenCalledTimes(0);
    expect(businessService.setRiskScore).toHaveBeenCalledTimes(0);
    expect(businessService.resetEvaluation).toHaveBeenCalledTimes(0);
  });

  test('a service failure is nacked and not acked', async () => {
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

    expect(results.nackMessage).toHaveBeenCalledWith(message, false);
    expect(results.ackMessage).toHaveBeenCalledTimes(0);
  });
});
