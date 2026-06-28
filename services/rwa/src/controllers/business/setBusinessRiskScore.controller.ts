import { Elysia } from 'elysia';
import type { ServicesPlugin } from '../../plugins/services.plugin';
import { setBusinessRiskScoreRequest, setBusinessRiskScoreResponse } from '../../models/validation/business.validation';

export const setBusinessRiskScoreController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'SetBusinessRiskScoreController' }).use(servicesPlugin).post(
    '/setBusinessRiskScore',
    async ({ body, businessService }) => {
      return await businessService.setRiskScore(body);
    },
    {
      body: setBusinessRiskScoreRequest,
      response: setBusinessRiskScoreResponse,
    },
  );
};
