/**
 * Daemon tests for SignatureDaemon.
 *
 * Scope: the daemon wired to the real SignatureService and a fake
 * signers-manager client. The fake captures the consumer callback passed to
 * consumeRequests(), so the tests invoke the daemon exactly the way RabbitMQ
 * would — with synthetic amqplib-shaped ConsumeMessage objects carrying the
 * serialized { hash, taskId, expired } request. No broker, no network. Run with
 * `bun test` from services/signer.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';
import { SignatureDaemon } from '../src/daemons/signature.daemon';
import { SignatureService } from '../src/services/signature.service';
import type { SignersManagerClient } from '../src/clients/signersManager.client';
import { createFakeSignersManagerClient, type FakeSignersManagerClient } from './fakes/signersManager.client.fake';

// Same deterministic signer as in signature.service.test.ts.
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const SIGNER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const HASH = `0x${'11'.repeat(32)}`;
const TASK_ID = 'task-42';

const FUTURE_EXPIRED = 4102444800; // 2100-01-01T00:00:00Z
const PAST_EXPIRED = 1000000000; // 2001-09-09T01:46:40Z

type SignatureRequest = { hash?: string; taskId?: string; expired?: number };

/**
 * Synthetic delivery shaped like amqplib's ConsumeMessage: content/fields/
 * properties plus the top-level `redelivered` flag the daemon reads
 * (src/daemons/signature.daemon.ts:75).
 *
 * A string payload is used verbatim — that is how an unparseable body is built.
 */
function makeDelivery(payload: SignatureRequest | string, redelivered = false): ConsumeMessage {
  const content = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));

  return {
    content,
    fields: {
      consumerTag: 'test-consumer',
      deliveryTag: 1,
      redelivered,
      exchange: 'sign.exchange',
      routingKey: '',
    },
    properties: {},
    redelivered,
  } as unknown as ConsumeMessage;
}

/**
 * The same delivery without the top-level flag — the exact shape amqplib builds
 * ({ fields, properties, content }), where `redelivered` lives only in `fields`.
 */
function toAmqplibShape(message: ConsumeMessage): ConsumeMessage {
  const raw = { ...(message as unknown as Record<string, unknown>) };
  delete raw.redelivered;
  return raw as unknown as ConsumeMessage;
}

describe('SignatureDaemon (fake signers-manager client, real SignatureService)', () => {
  let manager: FakeSignersManagerClient;
  let service: SignatureService;
  let daemon: SignatureDaemon;
  let deliver: (msg: ConsumeMessage | null) => Promise<void>;

  beforeEach(async () => {
    manager = createFakeSignersManagerClient();
    service = new SignatureService(manager as unknown as SignersManagerClient, PRIVATE_KEY);
    daemon = new SignatureDaemon(manager as unknown as SignersManagerClient, service);

    await daemon.initialize();
    deliver = manager.capturedHandler!;
  });

  test('initialize: subscribes to the requests queue exactly once', () => {
    expect(manager.consumeRequests).toHaveBeenCalledTimes(1);
    expect(typeof deliver).toBe('function');
  });

  test('start/stop: flip the running flag and are idempotent', async () => {
    const state = daemon as unknown as { isRunning: boolean };
    expect(state.isRunning).toBe(false);

    await daemon.start();
    expect(state.isRunning).toBe(true);
    await daemon.start(); // already running — no-op
    expect(state.isRunning).toBe(true);

    await daemon.stop();
    expect(state.isRunning).toBe(false);
    await daemon.stop(); // already stopped — no-op
    expect(state.isRunning).toBe(false);
  });

  test('valid request: signs the payload, sends it back, then acks the message', async () => {
    const message = makeDelivery({ hash: HASH, taskId: TASK_ID, expired: FUTURE_EXPIRED });

    await deliver(message);

    expect(manager.sendSignature).toHaveBeenCalledTimes(1);
    const [response] = manager.sendSignature.mock.calls[0]!;
    expect(response.taskId).toBe(TASK_ID);
    expect(response.hash).toBe(HASH);
    expect(response.signer).toBe(SIGNER_ADDRESS);
    expect(response.signature).toMatch(/^0x[0-9a-f]{130}$/i);

    expect(manager.ackMessage).toHaveBeenCalledTimes(1);
    expect(manager.ackMessage).toHaveBeenCalledWith(message);
    expect(manager.nackMessage).toHaveBeenCalledTimes(0);
  });

  test('request with any required field missing: dropped with ack, never signed', async () => {
    // hash / taskId / expired are all required by the daemon's field check.
    const missingHash = makeDelivery({ taskId: TASK_ID, expired: FUTURE_EXPIRED });
    const missingTaskId = makeDelivery({ hash: HASH, expired: FUTURE_EXPIRED });
    const missingExpired = makeDelivery({ hash: HASH, taskId: TASK_ID });

    for (const message of [missingHash, missingTaskId, missingExpired]) await deliver(message);

    expect(manager.sendSignature).toHaveBeenCalledTimes(0);
    expect(manager.nackMessage).toHaveBeenCalledTimes(0);
    expect(manager.ackMessage).toHaveBeenCalledTimes(3);
    expect(manager.ackMessage).toHaveBeenCalledWith(missingHash);
    expect(manager.ackMessage).toHaveBeenCalledWith(missingTaskId);
    expect(manager.ackMessage).toHaveBeenCalledWith(missingExpired);
  });

  test('request with expired: 0: rejected as malformed (the field check treats 0 as absent)', async () => {
    // The presence check is `!request.expired`, so a zero deadline never reaches
    // the EXPIRED path of the service — it is dropped as a validation error.
    const message = makeDelivery({ hash: HASH, taskId: TASK_ID, expired: 0 });

    await deliver(message);

    expect(manager.sendSignature).toHaveBeenCalledTimes(0);
    expect(manager.ackMessage).toHaveBeenCalledWith(message);
    expect(manager.nackMessage).toHaveBeenCalledTimes(0);
  });

  test('request with a malformed hash: dropped with ack, never signed', async () => {
    // Only /^0x[0-9a-f]{64}$/i passes; '0x1234' is valid hex but not 32 bytes.
    const message = makeDelivery({ hash: '0x1234', taskId: TASK_ID, expired: FUTURE_EXPIRED });

    await deliver(message);

    expect(manager.sendSignature).toHaveBeenCalledTimes(0);
    expect(manager.ackMessage).toHaveBeenCalledWith(message);
    expect(manager.nackMessage).toHaveBeenCalledTimes(0);
  });

  test('expired request: dropped with ack (EXPIRED is permanent), never nacked', async () => {
    const message = makeDelivery({ hash: HASH, taskId: TASK_ID, expired: PAST_EXPIRED });

    await deliver(message);

    expect(manager.sendSignature).toHaveBeenCalledTimes(0);
    expect(manager.ackMessage).toHaveBeenCalledTimes(1);
    expect(manager.ackMessage).toHaveBeenCalledWith(message);
    expect(manager.nackMessage).toHaveBeenCalledTimes(0);
  });

  test('transient failure: nacked with requeue=true exactly once, not acked', async () => {
    // The manager client fails for an infrastructure reason: a plain Error, so no
    // AppError code marks it permanent.
    manager.sendSignature.mockImplementationOnce(async () => {
      throw new Error('broker unavailable');
    });
    const message = makeDelivery({ hash: HASH, taskId: TASK_ID, expired: FUTURE_EXPIRED });

    await expect(deliver(message)).resolves.toBeUndefined(); // the daemon swallows the error

    expect(manager.sendSignature).toHaveBeenCalledTimes(1);
    expect(manager.nackMessage).toHaveBeenCalledTimes(1);
    expect(manager.nackMessage).toHaveBeenCalledWith(message, true);
    expect(manager.ackMessage).toHaveBeenCalledTimes(0);
  });

  test('redelivered transient failure: dropped with ack instead of another nack', async () => {
    manager.sendSignature.mockImplementationOnce(async () => {
      throw new Error('broker unavailable');
    });
    const message = makeDelivery({ hash: HASH, taskId: TASK_ID, expired: FUTURE_EXPIRED }, true);

    await deliver(message);

    expect(manager.nackMessage).toHaveBeenCalledTimes(0);
    expect(manager.ackMessage).toHaveBeenCalledTimes(1);
    expect(manager.ackMessage).toHaveBeenCalledWith(message);
  });

  test('unparseable JSON: nacked with requeue=true on the first delivery', async () => {
    // JSON.parse throws a plain SyntaxError (no AppError code), so the daemon
    // treats a broken body as transient and asks for one redelivery.
    const message = makeDelivery('{ not json');

    await deliver(message);

    expect(manager.sendSignature).toHaveBeenCalledTimes(0);
    expect(manager.nackMessage).toHaveBeenCalledTimes(1);
    expect(manager.nackMessage).toHaveBeenCalledWith(message, true);
    expect(manager.ackMessage).toHaveBeenCalledTimes(0);
  });

  test('unparseable JSON: dropped with ack once redelivered', async () => {
    const message = makeDelivery('{ not json', true);

    await deliver(message);

    expect(manager.sendSignature).toHaveBeenCalledTimes(0);
    expect(manager.nackMessage).toHaveBeenCalledTimes(0);
    expect(manager.ackMessage).toHaveBeenCalledWith(message);
  });

  test('amqplib-shaped redelivered failure is nacked again (documented flag-location mismatch)', async () => {
    // A real broker delivery carries `redelivered` only in message.fields
    // (verified against amqplib 0.10.8 lib/channel.js, which builds
    // { fields, properties, content }), while the daemon reads a top-level
    // `message.redelivered` (src/daemons/signature.daemon.ts:75). With genuine
    // broker deliveries the flag is therefore never seen and the
    // "drop after one failed delivery" branch stays dead — a transient failure
    // is requeued again instead of being dropped. This test pins the current
    // behavior; flagged for the owner, not fixed here.
    manager.sendSignature.mockImplementationOnce(async () => {
      throw new Error('broker unavailable');
    });
    const message = toAmqplibShape(makeDelivery({ hash: HASH, taskId: TASK_ID, expired: FUTURE_EXPIRED }, true));

    await deliver(message);

    expect(manager.nackMessage).toHaveBeenCalledTimes(1);
    expect(manager.nackMessage).toHaveBeenCalledWith(message, true);
    expect(manager.ackMessage).toHaveBeenCalledTimes(0);
  });
});
