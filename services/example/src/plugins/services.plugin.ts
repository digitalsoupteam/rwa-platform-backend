import { Elysia } from 'elysia';
import { ExampleService } from '../services/example.service';
import type { RepositoriesPlugin } from './repositories.plugin';
import { withTraceSync } from '@shared/monitoring/src/tracing';

export const createServicesPlugin = (repositoriesPlugin: RepositoriesPlugin) => {
  const exampleService = withTraceSync('example.init.services.example', () => new ExampleService());

  const plugin = withTraceSync('example.init.services.plugin', () =>
    new Elysia({ name: 'Services' }).use(repositoriesPlugin).decorate('exampleService', exampleService),
  );

  return plugin;
};

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>;
