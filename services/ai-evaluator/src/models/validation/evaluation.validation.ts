import { t } from 'elysia';
import { entityTypeSchema } from '../shared/enums.model';

export const evaluationSchema = t.Object({
  id: t.String(),
  entityType: entityTypeSchema,
  parentId: t.String(),
  grandParentId: t.String(),
  ownerId: t.String(),
  ownerType: t.String(),
  riskScore: t.Number(),
  reasoning: t.String(),
  factors: t.Array(
    t.Object({
      name: t.String(),
      impact: t.String(),
      detail: t.String(),
    }),
  ),
  stage1Response: t.String(),
  stage2Response: t.String(),
  evaluatedDocuments: t.Array(
    t.Object({
      id: t.String(),
      name: t.String(),
      mimeType: t.String(),
    }),
  ),
  evaluatedImages: t.Array(
    t.Object({
      id: t.String(),
      name: t.String(),
    }),
  ),
  modelUsed: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

/* Evaluate pool risk */
export const evaluatePoolRiskRequest = t.Object({
  poolId: t.String(),
});
export const evaluatePoolRiskResponse = evaluationSchema;

/* Evaluate business risk */
export const evaluateBusinessRiskRequest = t.Object({
  businessId: t.String(),
});
export const evaluateBusinessRiskResponse = evaluationSchema;

/* Get evaluation */
export const getEvaluationRequest = t.Pick(evaluationSchema, ['id']);
export const getEvaluationResponse = evaluationSchema;

/* Get evaluations list */
export const getEvaluationsRequest = t.Object({
  filter: t.Record(t.String(), t.Any()),
  sort: t.Optional(t.Record(t.String(), t.Union([t.Literal('asc'), t.Literal('desc')]))),
  limit: t.Optional(t.Number()),
  offset: t.Optional(t.Number()),
});
export const getEvaluationsResponse = t.Array(evaluationSchema);
