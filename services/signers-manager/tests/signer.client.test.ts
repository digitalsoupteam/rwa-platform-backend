/**
 * Unit tests for SignerClient.
 *
 * RabbitMQ is replaced with an in-memory fake of RabbitMQClient
 * (tests/fakes/rabbitmq.client.fake.ts), so the client is exercised without a
 * broker while every broker call is asserted: exchange declarations, the
 * responses queue with its TTL and retry topology, and fanout routing.
 * Consuming and acks are not the client's job anymore: they live in
 * ReliableConsumer (pinned by the daemon tests). Run with `bun test` from
 * services/signers-manager.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { AppError } from '@shared/errors/app-errors';
import type { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { SignerClient, type SignatureRequest } from '../src/clients/signer.client';
import { createFakeRabbitMQClient, type FakeRabbitMQClient } from './fakes/rabbitmq.client.fake';

const REQUEST: SignatureRequest = {
  hash: `0x${'11'.repeat(32)}`,
  taskId: '000000000000000000000001',
  expired: 2_000_000_000,
};

describe('SignerClient (unit, fake RabbitMQ client)', () => {
  let rabbit: FakeRabbitMQClient;
  let client: SignerClient;

  beforeEach(() => {
    rabbit = createFakeRabbitMQClient();
    client = new SignerClient(rabbit as unknown as RabbitMQClient);
  });

  test('initialize: declares the fanout exchange and the responses queue with TTL and retry topology', async () => {
    await client.initialize();

    expect(rabbit.setupExchange).toHaveBeenCalledWith('sign.exchange', 'fanout', { durable: true });

    // The 1h TTL stays; failed responses are retried via sign.responses.retry
    // and parked in sign.responses.parked.
    expect(rabbit.setupQueue).toHaveBeenCalledWith('sign.responses', {
      durable: true,
      arguments: {
        'x-message-ttl': 3600000,
        'x-dead-letter-exchange': 'sign.responses.retry.exchange',
        'x-dead-letter-routing-key': 'sign.responses.retry',
      },
    });
    expect(rabbit.setupExchange).toHaveBeenCalledWith('sign.responses.retry.exchange', 'direct', { durable: true });
    expect(rabbit.setupQueue).toHaveBeenCalledWith('sign.responses.retry', {
      durable: true,
      arguments: {
        'x-message-ttl': 10_000,
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'sign.responses',
      },
    });
    expect(rabbit.setupQueue).toHaveBeenCalledWith('sign.responses.parked', { durable: true });
    expect(rabbit.bindQueue).toHaveBeenCalledWith(
      'sign.responses.retry',
      'sign.responses.retry.exchange',
      'sign.responses.retry',
    );

    expect(rabbit.callLog).toEqual([
      'setupExchange',
      'setupExchange',
      'setupQueue',
      'setupQueue',
      'setupQueue',
      'bindQueue',
    ]);
  });

  test('sendSignatureTask: publishes to the fanout exchange without a binding key', async () => {
    await client.sendSignatureTask(REQUEST);

    expect(rabbit.publish).toHaveBeenCalledTimes(1);
    expect(rabbit.publish).toHaveBeenCalledWith('sign.exchange', '', REQUEST);
  });

  test('sendSignatureTask: a broker failure propagates to the caller', async () => {
    // e.g. shared/rabbitmq throws this when the channel was never established.
    rabbit.publish.mockRejectedValueOnce(
      new AppError({ message: 'RabbitMQ channel not initialized', statusCode: 503, code: 'SERVICE_UNAVAILABLE' }),
    );

    await expect(client.sendSignatureTask(REQUEST)).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });
});
