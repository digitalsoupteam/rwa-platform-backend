import { Elysia } from 'elysia';
import type { ServicesPlugin } from '../../plugins/services.plugin';
import { requestPoolEvaluationRequest, requestPoolEvaluationResponse } from '../../models/validation/pool.validation';

export const requestPoolEvaluationController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'RequestPoolEvaluationController' }).use(servicesPlugin).post(
    '/requestPoolEvaluation',
    async ({ body, poolService }) => {
      return await poolService.requestEvaluation(body);
    },
    {
      body: requestPoolEvaluationRequest,
      response: requestPoolEvaluationResponse,
    },
  );
};
