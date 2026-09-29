/**
 * Unit tests for TaskResponsesDaemon.
 *
 * The daemon registers its consumer on the fake RabbitMQ client; tests invoke
 * that handler with synthetic amqplib-shaped messages (content Buffer, fields,
 * redelivered flag). SignaturesService runs for real on top of fake
 * repositories, so both the service interactions and the reliability decisions
 * (ack / retry through the retry queue / park into `sign.responses.parked`) are
 * asserted. No broker is involved. Run with `bun test` from services/signers-manager.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';
import { TaskResponsesDaemon } from '../src/daemons/taskResponses.daemon';
import { SIGN_RESPONSES_QUEUE } from '../src/clients/signer.client';
import { SignaturesService } from '../src/services/signatures.service';
import type { SignerClient } from '../src/clients/signer.client';
import type { SignatureRepository } from '../src/repositories/signature.repository';
import type { SignatureTaskRepository } from '../src/repositories/signatureTask.repository';
import { createFakeSignerClient, type FakeSignerClient } from './fakes/signer.client.fake';
import { createFakeSignatureRepository, type FakeSignatureRepository } from './fakes/signature.repository.fake';
import {
  createFakeSignatureTaskRepository,
  type FakeSignatureTaskRepository,
} from './fakes/signatureTask.repository.fake';
import { createFakeRabbitMQClient, type FakeRabbitMQClient } from './fakes/rabbitmq.client.fake';

const INNER_HASH = `0x${'11'.repeat(32)}`;
const EXPIRED_FUTURE = 2_000_000_000;
const SIGNER_1 = '0x1111111111111111111111111111111111111111';
const SIGNATURE_1 = `0x${'ab'.repeat(65)}`;

const TASK = {
  ownerId: 'owner-1',
  ownerType: 'business',
  hash: INNER_HASH,
  requiredSignatures: 2,
  expired: EXPIRED_FUTURE,
};

/** Synthetic amqplib message: a JSON body in content plus delivery metadata. */
function buildMessage(payload: unknown, options: { redelivered?: boolean } = {}): ConsumeMessage {
  return {
    content: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)),
    fields: {
      consumerTag: 'ctag-1',
      deliveryTag: 1,
      redelivered: options.redelivered ?? false,
      exchange: 'sign.exchange',
      routingKey: 'sign.responses',
    },
    properties: {},
  } as unknown as ConsumeMessage;
}

describe('TaskResponsesDaemon (unit, fake broker and repositories)', () => {
  let rabbit: FakeRabbitMQClient;
  let signerClient: FakeSignerClient;
  let signatures: FakeSignatureRepository;
  let tasks: FakeSignatureTaskRepository;
  let service: SignaturesService;
  let daemon: TaskResponsesDaemon;
  let handler: (message: ConsumeMessage | null) => Promise<void>;

  beforeEach(async () => {
    rabbit = createFakeRabbitMQClient();
    signerClient = createFakeSignerClient();
    signatures = createFakeSignatureRepository();
    tasks = createFakeSignatureTaskRepository();
    service = new SignaturesService(
      signatures as unknown as SignatureRepository,
      tasks as unknown as SignatureTaskRepository,
      signerClient as unknown as SignerClient,
    );
    daemon = new TaskResponsesDaemon(rabbit as unknown as never, service);

    await daemon.initialize();
    handler = rabbit.consumedHandlers.get(SIGN_RESPONSES_QUEUE)!;
  });

  test('initialize: registers a response handler through the signer client', () => {
    expect(rabbit.consume).toHaveBeenCalledTimes(1);
    expect(rabbit.consume.mock.calls[0][0]).toBe(SIGN_RESPONSES_QUEUE);
    expect(typeof handler).toBe('function');
  });

  test('initialize: a consuming failure propagates to the caller', async () => {
    rabbit.consume.mockImplementationOnce(async () => {
      throw new Error('broker unavailable');
    });

    await expect(daemon.initialize()).rejects.toThrow('broker unavailable');
  });

  test('a valid response is added to the task and acknowledged', async () => {
    const task = await service.createTask(TASK);
    const message = buildMessage({ signer: SIGNER_1, hash: task.hash, signature: SIGNATURE_1, taskId: task.id });

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(1);
    expect(signatures.create).toHaveBeenCalledWith({ taskId: task.id, signer: SIGNER_1, signature: SIGNATURE_1 });
    expect(signatures.countByTaskId).toHaveBeenCalledWith(task.id);
    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
  });

  test('the response hash is only checked for presence, never matched against the task', async () => {
    // Faithful to src: the daemon validates that `hash` is present, then passes
    // only taskId/signer/signature to the service — a wrong hash still lands.
    const task = await service.createTask(TASK);
    const message = buildMessage({
      signer: SIGNER_1,
      hash: `0x${'99'.repeat(32)}`,
      signature: SIGNATURE_1,
      taskId: task.id,
    });

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(1);
    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
  });

  test('a null message (consumer cancel noise) is ignored without ack or nack', async () => {
    await handler(null);

    expect(signatures.create).toHaveBeenCalledTimes(0);
    expect(rabbit.acked).toHaveLength(0);
    expect(rabbit.nacked).toHaveLength(0);
  });

  test('an unparseable body is parked', async () => {
    const message = buildMessage('not-json{');

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(0);
    expect(rabbit.nacked).toHaveLength(0);
    expect(rabbit.acked).toEqual([message]); // parked = republished into the park queue, then acked
    expect(rabbit.sent).toHaveLength(1);
    expect(rabbit.sent[0].queue).toBe('sign.responses.parked');
    expect(rabbit.sent[0].content.content).toBe('not-json{');
  });

  test('a JSON body that is not an object is parked', async () => {
    const message = buildMessage('null');

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(0);
    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
    expect(rabbit.sent[0].queue).toBe('sign.responses.parked');
    expect(rabbit.sent[0].content.content).toBeNull();
  });

  test('a response with a missing required field never reaches the service and is parked', async () => {
    const message = buildMessage({ signer: SIGNER_1, hash: INNER_HASH, signature: SIGNATURE_1 }); // no taskId

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(0);
    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
    expect(rabbit.sent[0].queue).toBe('sign.responses.parked');
  });

  test('a service rejection (unknown task) is parked for inspection', async () => {
    const message = buildMessage({ signer: SIGNER_1, hash: INNER_HASH, signature: SIGNATURE_1, taskId: 'unknown-id' });

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(0);
    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
    expect(rabbit.sent[0].queue).toBe('sign.responses.parked');
    expect(rabbit.sent[0].content.reason).toMatch(/not found/i);
  });

  test('redelivery does not change the decision: a redelivered valid response is processed and acked', async () => {
    const task = await service.createTask(TASK);
    const message = buildMessage(
      { signer: SIGNER_1, hash: task.hash, signature: SIGNATURE_1, taskId: task.id },
      { redelivered: true },
    );

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(1);
    expect(rabbit.acked).toEqual([message]);
    expect(rabbit.nacked).toHaveLength(0);
  });

  test('a transient database failure earns a retry through the retry queue', async () => {
    const task = await service.createTask(TASK);
    signatures.create.mockImplementationOnce(async () => {
      throw new Error('buffering timed out');
    });
    const message = buildMessage({ signer: SIGNER_1, hash: task.hash, signature: SIGNATURE_1, taskId: task.id });

    await handler(message);

    // Dead-lettered into `sign.responses.retry` instead of being dropped.
    expect(rabbit.nacked).toHaveLength(1);
    expect(rabbit.nacked[0].message).toBe(message);
    expect(rabbit.nacked[0].requeue).toBe(false);
    expect(rabbit.acked).toHaveLength(0);
  });
});
