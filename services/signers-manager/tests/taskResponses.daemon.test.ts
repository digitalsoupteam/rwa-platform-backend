/**
 * Unit tests for TaskResponsesDaemon.
 *
 * The daemon is driven through its real consumer seam: the fake SignerClient
 * captures the handler registered by initialize(), and tests invoke it with
 * synthetic amqplib-shaped messages (content Buffer, fields, redelivered flag).
 * SignaturesService runs for real on top of fake repositories, so both the
 * service interactions and the ack/nack decision are asserted; no broker is
 * involved. Run with `bun test` from services/signers-manager.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';
import { TaskResponsesDaemon } from '../src/daemons/taskResponses.daemon';
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

describe('TaskResponsesDaemon (unit, fake repositories and signer client)', () => {
  let signerClient: FakeSignerClient;
  let signatures: FakeSignatureRepository;
  let tasks: FakeSignatureTaskRepository;
  let service: SignaturesService;
  let daemon: TaskResponsesDaemon;

  beforeEach(() => {
    signerClient = createFakeSignerClient();
    signatures = createFakeSignatureRepository();
    tasks = createFakeSignatureTaskRepository();
    service = new SignaturesService(
      signatures as unknown as SignatureRepository,
      tasks as unknown as SignatureTaskRepository,
      signerClient as unknown as SignerClient,
    );
    daemon = new TaskResponsesDaemon(signerClient as unknown as SignerClient, service);
  });

  /** initialize() the daemon and return the handler the fake client captured. */
  async function startDaemon(): Promise<(message: ConsumeMessage | null) => Promise<void>> {
    await daemon.initialize();
    const handler = signerClient.getResponsesHandler();
    expect(typeof handler).toBe('function');

    return handler!;
  }

  test('initialize: registers a response handler through the signer client', async () => {
    await daemon.initialize();

    expect(signerClient.consumeResponses).toHaveBeenCalledTimes(1);
    expect(typeof signerClient.getResponsesHandler()).toBe('function');
  });

  test('initialize: a consuming failure propagates to the caller', async () => {
    signerClient.consumeResponses = mock(
      async (_handler: (message: ConsumeMessage | null) => Promise<void>): Promise<never> => {
        throw new Error('broker unavailable');
      },
    ) as typeof signerClient.consumeResponses;

    await expect(daemon.initialize()).rejects.toThrow('broker unavailable');
  });

  test('a valid response is added to the task and acknowledged', async () => {
    const task = await service.createTask(TASK);
    const handler = await startDaemon();
    const message = buildMessage({ signer: SIGNER_1, hash: task.hash, signature: SIGNATURE_1, taskId: task.id });

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(1);
    expect(signatures.create).toHaveBeenCalledWith({ taskId: task.id, signer: SIGNER_1, signature: SIGNATURE_1 });
    expect(signatures.countByTaskId).toHaveBeenCalledWith(task.id);
    expect(signerClient.ackMessage).toHaveBeenCalledTimes(1);
    expect(signerClient.ackMessage).toHaveBeenCalledWith(message);
    expect(signerClient.nackMessage).toHaveBeenCalledTimes(0);
  });

  test('the response hash is only checked for presence, never matched against the task', async () => {
    // Faithful to src: the daemon validates that `hash` is present, then passes
    // only taskId/signer/signature to the service — a wrong hash still lands.
    const task = await service.createTask(TASK);
    const handler = await startDaemon();
    const message = buildMessage({
      signer: SIGNER_1,
      hash: `0x${'99'.repeat(32)}`,
      signature: SIGNATURE_1,
      taskId: task.id,
    });

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(1);
    expect(signerClient.ackMessage).toHaveBeenCalledWith(message);
    expect(signerClient.nackMessage).toHaveBeenCalledTimes(0);
  });

  test('a null message (consumer cancel noise) is ignored without ack or nack', async () => {
    const handler = await startDaemon();

    await handler(null);

    expect(signatures.create).toHaveBeenCalledTimes(0);
    expect(signerClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(signerClient.nackMessage).toHaveBeenCalledTimes(0);
  });

  test('an unparseable body is dropped without requeue', async () => {
    const handler = await startDaemon();
    const message = buildMessage('not-json{');

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(0);
    expect(signerClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(signerClient.nackMessage).toHaveBeenCalledTimes(1);
    expect(signerClient.nackMessage).toHaveBeenCalledWith(message, false);
  });

  test('a JSON body that is not an object is dropped without requeue', async () => {
    const handler = await startDaemon();
    const message = buildMessage('null');

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(0);
    expect(signerClient.nackMessage).toHaveBeenCalledWith(message, false);
    expect(signerClient.ackMessage).toHaveBeenCalledTimes(0);
  });

  test('a response with a missing required field never reaches the service and is dropped without requeue', async () => {
    const handler = await startDaemon();
    const message = buildMessage({ signer: SIGNER_1, hash: INNER_HASH, signature: SIGNATURE_1 }); // no taskId

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(0);
    expect(signerClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(signerClient.nackMessage).toHaveBeenCalledTimes(1);
    expect(signerClient.nackMessage).toHaveBeenCalledWith(message, false);
  });

  test('a service rejection (unknown task) is dropped without requeue and never acked', async () => {
    const handler = await startDaemon();
    const message = buildMessage({ signer: SIGNER_1, hash: INNER_HASH, signature: SIGNATURE_1, taskId: 'unknown-id' });

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(0);
    expect(signerClient.ackMessage).toHaveBeenCalledTimes(0);
    expect(signerClient.nackMessage).toHaveBeenCalledTimes(1);
    expect(signerClient.nackMessage).toHaveBeenCalledWith(message, false);
  });

  test('redelivery does not change the decision: a redelivered valid response is processed and acked', async () => {
    const task = await service.createTask(TASK);
    const handler = await startDaemon();
    const message = buildMessage(
      { signer: SIGNER_1, hash: task.hash, signature: SIGNATURE_1, taskId: task.id },
      { redelivered: true },
    );

    await handler(message);

    expect(signatures.create).toHaveBeenCalledTimes(1);
    expect(signerClient.ackMessage).toHaveBeenCalledWith(message);
    expect(signerClient.nackMessage).toHaveBeenCalledTimes(0);
  });
});
