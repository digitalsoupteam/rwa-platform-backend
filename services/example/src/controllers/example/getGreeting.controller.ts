import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import type { ServicesPlugin } from '../../plugins/services.plugin';
import { greetingResponse } from '../../models/validation/example.validation';

export const getGreetingController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'GetGreetingController' }).use(servicesPlugin).post(
    '/getGreeting',
    async ({ exampleService }) => {
      logger.info('POST /getGreeting - Returning default greeting');

      return { message: exampleService.getDefaultGreeting() };
    },
    {
      response: greetingResponse,
    },
  );
};
