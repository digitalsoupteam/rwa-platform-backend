import { t } from 'elysia';

/*
 * Business type enum
 */
export const BusinessTypeList = ['growth', 'startup', 'franchise'] as const;

export const businessTypeSchema = t.Union([t.Literal('growth'), t.Literal('startup'), t.Literal('franchise')]);

export type BusinessType = typeof businessTypeSchema.static;
