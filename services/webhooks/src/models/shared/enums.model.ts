import { t } from 'elysia';

/*
 * Webhook event types
 *
 * Only events with a real publisher are listed — subscribers can rely on
 * every type here. New types are added together with the code that emits them.
 */
export const WebhookEventTypeList = ['pool.deployed', 'business.deployed'] as const;

export const webhookEventTypeSchema = t.Union(WebhookEventTypeList.map((v) => t.Literal(v)) as any);

export type WebhookEventType = typeof webhookEventTypeSchema.static;

/*
 * Delivery status
 */
export const DeliveryStatusList = ['pending', 'delivered', 'failed', 'dead_letter'] as const;

export const deliveryStatusSchema = t.Union(DeliveryStatusList.map((v) => t.Literal(v)) as any);

export type DeliveryStatus = typeof deliveryStatusSchema.static;
