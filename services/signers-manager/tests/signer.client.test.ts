/**
 * Unit tests for SignerClient.
 *
 * RabbitMQ is replaced with an in-memory fake of RabbitMQClient
 * (tests/fakes/rabbitmq.client.fake.ts), so the client is exercised without a
 * broker while every broker call is asserted: exchange/queue declarations,
 * fanout routing, response consumption with noAck: false, and ack/nack
 * forwarding. Run with `bun test` from services/signers-manager.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { ConsumeMessage } from 'amqplib';
import { AppError } from '@shared/errors/app-errors';
import type { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { SignerClient, type SignatureRequest } from '../src/clients/signer.client';
import { createFakeRabbitMQClient, type FakeRabbitMQClient } from './fakes/rabbitmq.client.fake';

const REQUEST: SignatureRequest = {
  hash: `0x${'11'.repeat(32)}`,
  taskId: '000000000000000000000001',
  expired: 2_000_000_000,
};

function buildMessage(): ConsumeMessage {
  return {
    content: Buffer.from(
      JSON.stringify({ signer: '0x1111111111111111111111111111111111111111', ...REQUEST, signature: '0xsig' }),
    ),
    fields: {
      consumerTag: 'ctag-1',
      deliveryTag: 1,
      redelivered: false,
      exchange: 'sign.exchange',
      routingKey: 'sign.responses',
    },
    properties: {},
  } as unknown as ConsumeMessage;
}

describe('SignerClient (unit, fake RabbitMQ client)', () => {
  let rabbit: FakeRabbitMQClient;
  let client: SignerClient;

  beforeEach(() => {
    rabbit = createFakeRabbitMQClient();
    client = new SignerClient(rabbit as unknown as RabbitMQClient);
  });

  test('initialize: declares the fanout exchange and the responses queue with a 1h TTL', async () => {
    await client.initialize();

    expect(rabbit.setupExchange).toHaveBeenCalledTimes(1);
    expect(rabbit.setupExchange).toHaveBeenCalledWith('sign.exchange', 'fanout', { durable: true });
    expect(rabbit.setupQueue).toHaveBeenCalledTimes(1);
    expect(rabbit.setupQueue).toHaveBeenCalledWith('sign.responses', {
      durable: true,
      arguments: { 'x-message-ttl': 3600000 },
    });
    expect(rabbit.callLog).toEqual(['setupExchange', 'setupQueue']);
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

  test('consumeResponses: consumes the responses queue with manual ack', async () => {
    const handler = async (_message: ConsumeMessage | null): Promise<void> => {};

    await client.consumeResponses(handler);

    expect(rabbit.consume).toHaveBeenCalledTimes(1);
    expect(rabbit.consume).toHaveBeenCalledWith('sign.responses', handler, { noAck: false });
    expect(rabbit.getConsumedHandler('sign.responses')).toBe(handler);
  });

  test('ackMessage: forwards the message to the broker ack', async () => {
    const message = buildMessage();

    await client.ackMessage(message);

    expect(rabbit.ack).toHaveBeenCalledTimes(1);
    expect(rabbit.ack).toHaveBeenCalledWith(message);
  });

  test('nackMessage: defaults to requeue and honours an explicit requeue: false', async () => {
    const message = buildMessage();

    await client.nackMessage(message);
    await client.nackMessage(message, false);

    expect(rabbit.nack).toHaveBeenCalledTimes(2);
    expect(rabbit.nack.mock.calls).toEqual([
      [message, true],
      [message, false],
    ]);
  });
});
