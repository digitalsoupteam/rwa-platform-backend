import { Elysia } from 'elysia';
import type { ServicesPlugin } from '../plugins/services.plugin';
import { evaluateBusinessRiskRequest, evaluateBusinessRiskResponse } from '../models/validation/evaluation.validation';

export const evaluateBusinessRiskController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'EvaluateBusinessRiskController' }).use(servicesPlugin).post(
    '/evaluateBusinessRisk',
    async ({ body, riskEvaluationService }) => {
      return await riskEvaluationService.evaluateBusinessRisk(body);
    },
    {
      body: evaluateBusinessRiskRequest,
      response: evaluateBusinessRiskResponse,
    },
  );
};
