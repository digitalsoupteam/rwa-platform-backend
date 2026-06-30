import { t } from 'elysia';

/*
 * Delivery log response
 */
export const deliveryLogSchema = t.Object({
  id: t.String(),
  endpointId: t.String(),
  eventType: t.String(),
  eventId: t.String(),
  status: t.String(),
  attempts: t.Array(
    t.Object({
      timestamp: t.Number(),
      statusCode: t.Optional(t.Number()),
      responseBody: t.String(),
      error: t.String(),
    }),
  ),
  nextRetryAt: t.Optional(t.Number()),
  createdAt: t.Number(),
});

export type IDeliveryLogDTO = typeof deliveryLogSchema.static;
