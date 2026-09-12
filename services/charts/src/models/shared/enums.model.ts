import { t } from 'elysia';

/*
 * Pool transaction type enum
 */
export const PoolTransactionType = {
  MINT: 'MINT',
  BURN: 'BURN',
} as const;

export const PoolTransactionTypeList = ['MINT', 'BURN'] as const;

export const poolTransactionTypeSchema = t.Union([t.Literal('MINT'), t.Literal('BURN')]);

export type PoolTransactionType = typeof poolTransactionTypeSchema.static;
