import { t } from 'elysia';

/*
 * Webhook event types
 */
export const WebhookEventTypeList = [
  'pool.created',
  'pool.staked',
  'pool.burned',
  'business.created',
  'business.verified',
  'document.uploaded',
  'document.verified',
  'loyalty.reward',
  'proposal.created',
  'proposal.executed',
  'vote.cast',
  'user.registered',
  'user.verified',
] as const;

export const webhookEventTypeSchema = t.Union(WebhookEventTypeList.map((v) => t.Literal(v)) as any);

export type WebhookEventType = typeof webhookEventTypeSchema.static;

/*
 * Delivery status
 */
export const DeliveryStatusList = ['pending', 'delivered', 'failed', 'dead_letter'] as const;

export const deliveryStatusSchema = t.Union(DeliveryStatusList.map((v) => t.Literal(v)) as any);

export type DeliveryStatus = typeof deliveryStatusSchema.static;
