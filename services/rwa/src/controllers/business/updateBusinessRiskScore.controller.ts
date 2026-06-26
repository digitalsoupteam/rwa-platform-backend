import { Elysia } from 'elysia';
import type { ServicesPlugin } from '../../plugins/services.plugin';
import {
  updateBusinessRiskScoreRequest,
  updateBusinessRiskScoreResponse,
} from '../../models/validation/business.validation';

export const updateBusinessRiskScoreController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'UpdateBusinessRiskScoreController' }).use(servicesPlugin).post(
    '/updateBusinessRiskScore',
    async ({ body, businessService }) => {
      return await businessService.updateRiskScore(body.id);
    },
    {
      body: updateBusinessRiskScoreRequest,
      response: updateBusinessRiskScoreResponse,
    },
  );
};
