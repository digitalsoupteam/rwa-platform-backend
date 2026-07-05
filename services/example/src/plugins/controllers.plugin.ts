import { Elysia } from 'elysia';
import { getGreetingController } from '../controllers/example/getGreeting.controller';
import { withTraceSync } from '@shared/monitoring/src/tracing';
import type { ServicesPlugin } from './services.plugin';

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const getGreetingCtrl = withTraceSync('example.init.controllers.get_greeting', () =>
    getGreetingController(servicesPlugin),
  );

  const plugin = withTraceSync('example.init.controllers.plugin', () =>
    new Elysia({ name: 'Controllers' }).use(getGreetingCtrl),
  );

  return plugin;
};

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>;
