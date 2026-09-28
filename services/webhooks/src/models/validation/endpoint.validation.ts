import { t } from 'elysia';
import { webhookEventTypeSchema } from '../shared/enums.model';

/*
 * Requests accept only known event types, so a typo cannot silently create a
 * subscription that never fires. Responses stay permissive: endpoints created
 * before an event type was removed must remain readable.
 */
const requestEventsSchema = t.Array(webhookEventTypeSchema, { uniqueItems: true });
const requestRateLimitSchema = t.Number({ minimum: 1, maximum: 100000 });

/*
 * Base endpoint schema
 */
export const endpointSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  wallet: t.String(),
  url: t.String(),
  events: t.Array(t.String()),
  description: t.String(),
  active: t.Boolean(),
  rateLimitPerMinute: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export type IEndpointDTO = typeof endpointSchema.static;

/*
 * Create endpoint
 */
export const createEndpointRequest = t.Composite([
  t.Pick(endpointSchema, ['userId', 'wallet', 'url']),
  t.Object({ events: requestEventsSchema }),
  t.Partial(t.Object({ description: t.String(), rateLimitPerMinute: requestRateLimitSchema })),
]);
export const createEndpointResponse = t.Composite([
  t.Pick(endpointSchema, [
    'id',
    'userId',
    'wallet',
    'url',
    'events',
    'description',
    'active',
    'rateLimitPerMinute',
    'createdAt',
    'updatedAt',
  ]),
  t.Object({ secret: t.String() }),
]);

/*
 * Get endpoints (list)
 */
export const getEndpointsRequest = t.Pick(endpointSchema, ['userId', 'wallet']);
export const getEndpointsResponse = t.Array(
  t.Pick(endpointSchema, [
    'id',
    'userId',
    'wallet',
    'url',
    'events',
    'description',
    'active',
    'rateLimitPerMinute',
    'createdAt',
    'updatedAt',
  ]),
);

/*
 * Get endpoint (one)
 */
export const getEndpointRequest = t.Composite([
  t.Pick(endpointSchema, ['id']),
  t.Pick(endpointSchema, ['userId', 'wallet']),
]);
export const getEndpointResponse = endpointSchema;

/*
 * Update endpoint
 */
export const updateEndpointRequest = t.Composite([
  t.Pick(endpointSchema, ['id', 'userId', 'wallet']),
  t.Partial(
    t.Object({
      url: t.String(),
      events: requestEventsSchema,
      description: t.String(),
      active: t.Boolean(),
      rateLimitPerMinute: requestRateLimitSchema,
    }),
  ),
]);
export const updateEndpointResponse = t.Composite([
  t.Pick(endpointSchema, [
    'id',
    'userId',
    'wallet',
    'url',
    'events',
    'description',
    'active',
    'rateLimitPerMinute',
    'createdAt',
    'updatedAt',
  ]),
  t.Partial(t.Object({ secret: t.String() })),
]);

/*
 * Delete endpoint
 */
export const deleteEndpointRequest = t.Composite([
  t.Pick(endpointSchema, ['id']),
  t.Pick(endpointSchema, ['userId', 'wallet']),
]);
export const deleteEndpointResponse = t.Pick(endpointSchema, ['id']);
