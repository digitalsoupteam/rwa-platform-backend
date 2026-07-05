import { Elysia } from 'elysia';
import { sampleRequest, sampleResponse } from '../models/validation/sample.validation';
import type { ServicesPlugin } from '../plugins/services.plugin';

export const createSampleController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'SampleController' }).use(servicesPlugin).post(
    '/sample',
    async ({ body, sampleService }) => {
      return await sampleService.process(body);
    },
    {
      body: sampleRequest,
      response: sampleResponse,
    },
  );
};
