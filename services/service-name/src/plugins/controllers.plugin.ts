import { Elysia } from 'elysia';
import { createSampleController } from '../controllers/sample.controller';
import { withTraceSync } from '@shared/monitoring/src/tracing';
import type { ServicesPlugin } from './services.plugin';

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const sampleController = withTraceSync('<service-name>.init.controllers.sample', () =>
    createSampleController(servicesPlugin),
  );

  const plugin = withTraceSync('<service-name>.init.controllers.plugin', () =>
    new Elysia({ name: 'Controllers' }).use(sampleController),
  );

  return plugin;
};

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>;
