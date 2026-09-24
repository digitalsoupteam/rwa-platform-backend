/**
 * Synthetic amqplib ConsumeMessage shapes for daemon tests.
 *
 * The daemons only read `content` (a Buffer holding JSON) and, through their
 * log decorators, `fields.routingKey` / `fields.redelivered`. Tests build
 * messages with this helper instead of taking a real broker delivery, so no
 * connection is ever opened. Passing a string as `content` keeps it raw, which
 * is how malformed-payload cases are built.
 */
export type SyntheticConsumeMessage = {
  content: Buffer;
  fields: {
    consumerTag: string;
    deliveryTag: number;
    redelivered: boolean;
    exchange: string;
    routingKey: string;
  };
  properties: {
    contentType: string;
    persistence: boolean;
    headers: Record<string, unknown>;
  };
};

export function createSyntheticMessage(
  content: unknown,
  options: { routingKey?: string; exchange?: string; redelivered?: boolean; deliveryTag?: number } = {},
): SyntheticConsumeMessage {
  return {
    content: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content), 'utf8'),
    fields: {
      consumerTag: 'ctag-1',
      deliveryTag: options.deliveryTag ?? 1,
      redelivered: options.redelivered ?? false,
      exchange: options.exchange ?? 'webhooks.events',
      routingKey: options.routingKey ?? 'pool.created',
    },
    properties: {
      contentType: 'application/json',
      persistence: true,
      headers: {},
    },
  };
}
