import { Elysia } from 'elysia';
import type { ServicesPlugin } from '../plugins/services.plugin';
import { evaluatePoolRiskRequest, evaluatePoolRiskResponse } from '../models/validation/evaluation.validation';

export const evaluatePoolRiskController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'EvaluatePoolRiskController' }).use(servicesPlugin).post(
    '/evaluatePoolRisk',
    async ({ body, riskEvaluationService }) => {
      return await riskEvaluationService.evaluatePoolRisk(body);
    },
    {
      body: evaluatePoolRiskRequest,
      response: evaluatePoolRiskResponse,
    },
  );
};
