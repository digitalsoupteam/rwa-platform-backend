/**
 * Component tests for the signers-manager HTTP layer.
 *
 * The Elysia app is assembled in-process the way src/app.ts does it, minus the
 * infrastructure-bound pieces: fake Repositories and Clients plugins expose the
 * same decorators the real plugins do, while the services and controllers
 * plugins are the real ones, and repositories/signer client are in-memory
 * fakes. Requests go through app.handle() — no port is bound, no Mongo is
 * queried, no message is published. The daemons plugin is deliberately not
 * mounted: it would register a real consumer. Run with `bun test` from
 * services/signers-manager.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { ethers } from 'ethers';
import { AppError } from '@shared/errors/app-errors';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createServicesPlugin } from '../src/plugins/services.plugin';
import { createControllersPlugin } from '../src/plugins/controllers.plugin';
import type { RepositoriesPlugin } from '../src/plugins/repositories.plugin';
import type { ClientsPlugin } from '../src/plugins/clients.plugin';
import type { SignaturesService } from '../src/services/signatures.service';
import { createFakeSignatureRepository, type FakeSignatureRepository } from './fakes/signature.repository.fake';
import {
  createFakeSignatureTaskRepository,
  type FakeSignatureTaskRepository,
} from './fakes/signatureTask.repository.fake';
import { createFakeSignerClient, type FakeSignerClient } from './fakes/signer.client.fake';
import { createFakeRabbitMQClient } from './fakes/rabbitmq.client.fake';

const INNER_HASH = `0x${'11'.repeat(32)}`; // bytes32 hex, the shape ethers.solidityPackedKeccak256 requires
const EXPIRED_FUTURE = 2_000_000_000; // 2033-05-18, far after any test run
const EXPIRED_LATER = 2_100_000_000;

const SIGNER_1 = '0x1111111111111111111111111111111111111111';
const SIGNATURE_1 = `0x${'ab'.repeat(65)}`;

const TASK = {
  ownerId: 'owner-1',
  ownerType: 'business',
  hash: INNER_HASH,
  requiredSignatures: 2,
  expired: EXPIRED_FUTURE,
};

/**
 * Independent derivation of the manager-side final hash:
 * keccak256(abi-packed bytes32 innerHash ++ uint256 expired), recomputed here
 * as raw keccak256 over the manually zero-padded concatenation, so the
 * assertion does not simply re-run the helper under test.
 */
function finalHash(innerHash: string, expired: number): string {
  return ethers.keccak256(ethers.concat([innerHash, ethers.zeroPadValue(ethers.toBeHex(expired), 32)]));
}

function buildApp(
  signatures: FakeSignatureRepository,
  tasks: FakeSignatureTaskRepository,
  signerClient: FakeSignerClient,
) {
  // Same decorator names the src plugins read (repositories.plugin.ts, clients.plugin.ts).
  const repositoriesPlugin = new Elysia({ name: 'Repositories' })
    .decorate('signatureRepository', signatures)
    .decorate('signatureTaskRepository', tasks);

  const clientsPlugin = new Elysia({ name: 'Clients' })
    .decorate('rabbitMQClient', createFakeRabbitMQClient())
    .decorate('signerClient', signerClient);

  const servicesPlugin = createServicesPlugin(
    repositoriesPlugin as unknown as RepositoriesPlugin,
    clientsPlugin as unknown as ClientsPlugin,
  );

  const app = new Elysia().onError(ErrorHandlerPlugin).use(createControllersPlugin(servicesPlugin));

  return { app, signaturesService: servicesPlugin.decorator.signaturesService as unknown as SignaturesService };
}

type App = ReturnType<typeof buildApp>['app'];

async function post(app: App, path: string, body: unknown) {
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

  return { status: response.status, body: (await response.json()) as any };
}

describe('signers-manager HTTP layer (component, fake repositories and signer client)', () => {
  let signatures: FakeSignatureRepository;
  let tasks: FakeSignatureTaskRepository;
  let signerClient: FakeSignerClient;
  let app: App;
  let signaturesService: SignaturesService;

  beforeEach(() => {
    signatures = createFakeSignatureRepository();
    tasks = createFakeSignatureTaskRepository();
    signerClient = createFakeSignerClient();
    ({ app, signaturesService } = buildApp(signatures, tasks, signerClient));
  });

  test('createSignatureTask → getSignatureTask round-trip over the derived final hash', async () => {
    const created = await post(app, '/createSignatureTask', TASK);

    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
      ownerId: TASK.ownerId,
      ownerType: TASK.ownerType,
      requiredSignatures: TASK.requiredSignatures,
      expired: TASK.expired,
      completed: false,
    });
    expect(created.body.hash).toBe(finalHash(INNER_HASH, EXPIRED_FUTURE));
    expect(typeof created.body.id).toBe('string');
    expect(created.body.id).toHaveLength(24);
    expect(created.body).not.toHaveProperty('_id');
    expect(signerClient.sendSignatureTask).toHaveBeenCalledWith({
      hash: finalHash(INNER_HASH, EXPIRED_FUTURE),
      taskId: created.body.id,
      expired: EXPIRED_FUTURE,
    });

    const fetched = await post(app, '/getSignatureTask', { taskId: created.body.id });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);
    expect(fetched.body.signatures).toBeUndefined(); // an open task exposes no signatures
  });

  test('createSignatureTask: an invalid payload never reaches the service', async () => {
    const response = await post(app, '/createSignatureTask', { ownerId: 'owner-1' });

    expect(response.status).not.toBe(200);
    expect(tasks.create).toHaveBeenCalledTimes(0);
    expect(signerClient.sendSignatureTask).toHaveBeenCalledTimes(0);
  });

  test('getSignatureTask: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/getSignatureTask', { taskId: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'SignatureTask unknown-id not found' } });
  });

  test('createSignatureTask: a repository conflict maps to 409 and signers are not notified', async () => {
    // The real model's unique index on `hash` rejects an identical repeat inside
    // one expiry window (Mongo E11000); ErrorHandlerPlugin is what turns the
    // raised error into an HTTP response.
    tasks.create.mockRejectedValueOnce(
      new AppError({ message: 'Duplicate signature task', statusCode: 409, code: 'CONFLICT' }),
    );

    const response = await post(app, '/createSignatureTask', TASK);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: 'CONFLICT', message: 'Duplicate signature task' } });
    expect(signerClient.sendSignatureTask).toHaveBeenCalledTimes(0);
  });

  test('getSignatureTask: a completed task exposes its signatures without ids', async () => {
    const created = await post(app, '/createSignatureTask', { ...TASK, requiredSignatures: 1 });
    // Simulate what the taskResponses daemon does once a signer replies.
    await signaturesService.addSignature({ taskId: created.body.id, signer: SIGNER_1, signature: SIGNATURE_1 });

    const fetched = await post(app, '/getSignatureTask', { taskId: created.body.id });

    expect(fetched.status).toBe(200);
    expect(fetched.body.completed).toBe(true);
    expect(fetched.body.signatures).toEqual([{ signer: SIGNER_1, signature: SIGNATURE_1 }]);
  });

  test('createSignatureTask: the same inner hash with a fresh expiry is a separate task', async () => {
    const first = await post(app, '/createSignatureTask', TASK);
    const second = await post(app, '/createSignatureTask', { ...TASK, expired: EXPIRED_LATER });

    expect(second.status).toBe(200);
    expect(second.body.id).not.toBe(first.body.id);
    expect(second.body.hash).not.toBe(first.body.hash);
    expect(second.body.hash).toBe(finalHash(INNER_HASH, EXPIRED_LATER));
  });
});
