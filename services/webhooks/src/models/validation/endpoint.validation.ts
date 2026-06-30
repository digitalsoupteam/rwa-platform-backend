import { t } from 'elysia';

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
  t.Pick(endpointSchema, ['userId', 'wallet', 'url', 'events']),
  t.Partial(t.Pick(endpointSchema, ['description', 'rateLimitPerMinute'])),
]);
export const createEndpointResponse = t.Composite([
  t.Pick(endpointSchema, ['id', 'url', 'events', 'description', 'active', 'rateLimitPerMinute', 'createdAt']),
  t.Object({ secret: t.String() }),
]);

/*
 * Get endpoints (list)
 */
export const getEndpointsRequest = t.Pick(endpointSchema, ['userId', 'wallet']);
export const getEndpointsResponse = t.Array(
  t.Pick(endpointSchema, [
    'id',
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
  t.Partial(t.Pick(endpointSchema, ['url', 'events', 'description', 'active', 'rateLimitPerMinute'])),
]);
export const updateEndpointResponse = t.Composite([
  t.Pick(endpointSchema, [
    'id',
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
