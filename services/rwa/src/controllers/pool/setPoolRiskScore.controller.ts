import { Elysia } from 'elysia';
import type { ServicesPlugin } from '../../plugins/services.plugin';
import { setPoolRiskScoreRequest, setPoolRiskScoreResponse } from '../../models/validation/pool.validation';

export const setPoolRiskScoreController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'SetPoolRiskScoreController' }).use(servicesPlugin).post(
    '/setPoolRiskScore',
    async ({ body, poolService }) => {
      return await poolService.setRiskScore(body);
    },
    {
      body: setPoolRiskScoreRequest,
      response: setPoolRiskScoreResponse,
    },
  );
};
