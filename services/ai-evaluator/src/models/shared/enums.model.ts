import { t } from 'elysia';

/*
 * Entity type enum
 */
export const EntityTypeList = ['business', 'pool'] as const;

export const entityTypeSchema = t.Union([t.Literal('business'), t.Literal('pool')]);

export type EntityType = typeof entityTypeSchema.static;

/*
 * Evaluation status enum
 */
export const EvaluationStatusList = ['pending', 'completed', 'failed'] as const;

export const evaluationStatusSchema = t.Union([t.Literal('pending'), t.Literal('completed'), t.Literal('failed')]);

export type EvaluationStatus = typeof evaluationStatusSchema.static;
